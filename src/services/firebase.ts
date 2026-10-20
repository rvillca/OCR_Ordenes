import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  getDocFromServer,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { TechnicalOrder, REQUIRED_COLUMNS } from '../types/order.js';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
// CRITICAL: Must use firestoreDatabaseId parameter per skill instructions
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test Firestore connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline:', error.message);
      return false;
    }
    // Any response from server (even NOT_FOUND or permission denied) confirms connectivity
    return true;
  }
}

// Sign in with Google Popup
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(result.user);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// Bootstrap user profile and admin role
export async function ensureUserProfile(user: User): Promise<{ role: 'admin' | 'operador' }> {
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    const bootstrapAdminEmail = 't18.sitic@gmail.com';
    const isAdminUser = user.email?.toLowerCase() === bootstrapAdminEmail.toLowerCase();

    if (!snap.exists()) {
      const role = isAdminUser ? 'admin' : 'operador';
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Usuario Técnico',
        role,
        createdAt: new Date().toISOString(),
      });

      if (isAdminUser) {
        await setDoc(doc(db, 'admins', user.uid), {
          email: user.email,
          addedAt: new Date().toISOString(),
        });
      }
      return { role };
    }
    const data = snap.data();
    return { role: data?.role || (isAdminUser ? 'admin' : 'operador') };
  } catch (err) {
    console.warn('Could not read/write user profile:', err);
    return { role: user.email?.toLowerCase() === 't18.sitic@gmail.com' ? 'admin' : 'operador' };
  }
}

// Fingerprint generator for idempotency
export function generateOrderFingerprint(rec: {
  ot: string;
  ordenPhoenix: string;
  codigo: string;
  nombres: string;
  fecha: string;
}): string {
  const otKey = (rec.ot || '').trim().toUpperCase();
  const phoenixKey = (rec.ordenPhoenix || '').trim().toUpperCase();
  const codigoKey = (rec.codigo || '').trim().toUpperCase();
  const nombreKey = (rec.nombres || '').trim().toUpperCase();
  const fechaKey = (rec.fecha || '').trim();
  return `${otKey}:::${phoenixKey}:::${codigoKey}:::${nombreKey}:::${fechaKey}`;
}

export interface FirestoreOrderRecord {
  id: string;
  fecha: string;
  tecnico: string;
  tipo: string;
  codigo: string;
  ot: string;
  nombres: string;
  ordenPhoenix: string;
  nodo: string;
  estado: string;
  observacion: string; // MUST BE EMPTY STRING
  fingerprint: string;
  operationId: string;
  createdByUid: string;
  createdByEmail: string;
  sourceImageName?: string;
  createdAt: string;
}

// Save approved orders to Firestore with batching & idempotency
export async function saveApprovedOrdersToFirestore(
  orders: TechnicalOrder[],
  currentUser: User
): Promise<{
  savedCount: number;
  duplicateCount: number;
  savedIds: string[];
}> {
  if (!orders || orders.length === 0) {
    return { savedCount: 0, duplicateCount: 0, savedIds: [] };
  }

  // 1. Fetch existing fingerprints to guarantee idempotency on retries
  const ordersPath = 'orders';
  let existingFingerprints = new Set<string>();
  try {
    const q = query(collection(db, ordersPath), limit(250));
    const snapshot = await getDocs(q);
    snapshot.forEach((d) => {
      const data = d.data();
      if (data.fingerprint) existingFingerprints.add(data.fingerprint);
    });
  } catch (err) {
    console.warn('Could not check existing fingerprints; proceeding safely:', err);
  }

  const batch = writeBatch(db);
  const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const savedIds: string[] = [];
  let duplicateCount = 0;

  for (const ord of orders) {
    // Only approved orders
    if (!ord.approved) continue;

    const fp = generateOrderFingerprint(ord);
    if (existingFingerprints.has(fp)) {
      duplicateCount++;
      continue;
    }

    const cleanOt = (ord.ot || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const docId = `ord_${Date.now()}_${cleanOt || Math.random().toString(36).substring(2, 7)}`;
    const docRef = doc(db, ordersPath, docId);

    const firestoreData: FirestoreOrderRecord = {
      id: docId,
      fecha: ord.fecha || '',
      tecnico: ord.tecnico || '',
      tipo: ord.tipo || '',
      codigo: ord.codigo || '',
      ot: ord.ot || '',
      nombres: ord.nombres || '',
      ordenPhoenix: ord.ordenPhoenix || '',
      nodo: ord.nodo || '',
      estado: ord.estado || '',
      observacion: '', // STRICTLY EMPTY PER SPECIFICATION
      fingerprint: fp,
      operationId,
      createdByUid: currentUser.uid,
      createdByEmail: currentUser.email || 'anonimo@tecnico.com',
      sourceImageName: ord.imageName || '',
      createdAt: new Date().toISOString(),
    };

    batch.set(docRef, firestoreData);
    savedIds.push(ord.id); // original frontend id
    existingFingerprints.add(fp);
  }

  try {
    if (savedIds.length > 0) {
      await batch.commit();
    }
    return {
      savedCount: savedIds.length,
      duplicateCount,
      savedIds,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ordersPath);
    throw error;
  }
}

// Fetch orders in real time from Firestore with RBAC awareness
export function subscribeToFirestoreOrders(
  user: User | null,
  role: 'admin' | 'operador',
  onUpdate: (orders: FirestoreOrderRecord[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'orders';
  if (!user) {
    onUpdate([]);
    return () => {};
  }

  // Admin gets global view; Operador gets their own records
  const q =
    role === 'admin'
      ? query(collection(db, path), limit(300))
      : query(collection(db, path), where('createdByUid', '==', user.uid), limit(300));

  return onSnapshot(
    q,
    (snapshot) => {
      const records: FirestoreOrderRecord[] = [];
      snapshot.forEach((d) => {
        records.push({ id: d.id, ...(d.data() as any) });
      });
      // Sort in memory by createdAt descending
      records.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      onUpdate(records);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
    }
  );
}

// Update order fields in Firestore (for review / corrections)
export async function updateFirestoreOrder(
  orderDocId: string,
  updatedFields: Partial<FirestoreOrderRecord>
) {
  const path = `orders/${orderDocId}`;
  try {
    const docRef = doc(db, 'orders', orderDocId);
    // Strict rule: observacion must stay empty
    const sanitized = {
      ...updatedFields,
      observacion: '',
    };
    await updateDoc(docRef, sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Delete an order from Firestore (admin only)
export async function deleteFirestoreOrder(orderDocId: string) {
  const path = `orders/${orderDocId}`;
  try {
    await deleteDoc(doc(db, 'orders', orderDocId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Fetch all registered users for Admin management
export async function fetchAllUsers(): Promise<
  Array<{ uid: string; email: string; displayName: string; role: 'admin' | 'operador'; createdAt: string }>
> {
  const path = 'users';
  try {
    const snapshot = await getDocs(collection(db, path));
    const list: Array<{ uid: string; email: string; displayName: string; role: 'admin' | 'operador'; createdAt: string }> = [];
    snapshot.forEach((d) => {
      const data = d.data();
      list.push({
        uid: d.id,
        email: data.email || '',
        displayName: data.displayName || 'Usuario',
        role: data.role === 'admin' ? 'admin' : 'operador',
        createdAt: data.createdAt || '',
      });
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

// Update user role (admin only)
export async function updateUserRole(
  targetUid: string,
  targetEmail: string,
  newRole: 'admin' | 'operador'
) {
  const userPath = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, 'users', targetUid), { role: newRole });
    if (newRole === 'admin') {
      await setDoc(doc(db, 'admins', targetUid), {
        email: targetEmail,
        addedAt: new Date().toISOString(),
      });
    } else {
      await deleteDoc(doc(db, 'admins', targetUid));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

