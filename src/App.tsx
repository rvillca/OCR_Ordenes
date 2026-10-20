import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { BottomNav } from './components/BottomNav.js';
import { HomeTab } from './components/HomeTab.js';
import { UploadTab } from './components/UploadTab.js';
import { ReviewTab } from './components/ReviewTab.js';
import { HistoryTab } from './components/HistoryTab.js';
import { ConfigTab } from './components/ConfigTab.js';
import { ImageModal } from './components/ImageModal.js';
import { OfflineIndicator } from './components/OfflineIndicator.js';
import { TechnicalOrder, ImageUploadItem } from './types/order.js';
import {
  auth,
  loginWithGoogle,
  logoutUser,
  ensureUserProfile,
  testFirestoreConnection,
  subscribeToFirestoreOrders,
  FirestoreOrderRecord,
} from './services/firebase.js';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'home' | 'upload' | 'review' | 'history' | 'config'>('home');
  const [images, setImages] = useState<ImageUploadItem[]>([]);
  const [orders, setOrders] = useState<TechnicalOrder[]>([]);

  // Auth & Roles
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'operador'>('operador');
  const [firestoreConnected, setFirestoreConnected] = useState<boolean>(false);
  const [firestoreOrders, setFirestoreOrders] = useState<FirestoreOrderRecord[]>([]);

  // Google Sheets (secondary optional sync)
  const [sheetsConnected, setSheetsConnected] = useState<boolean>(false);
  const [sheetsConfig, setSheetsConfig] = useState({
    spreadsheetId: '',
    sheetName: 'Hoja 1',
    serviceAccountConfigured: false,
    serviceAccountEmail: null as string | null,
  });

  // Modal inspection
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    imageUrl?: string;
    imageName?: string;
    orderInfo?: any;
  }>({
    isOpen: false,
  });

  // Test Firestore connectivity on boot
  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setFirestoreConnected(connected);
    });
  }, []);

  // Listen to Auth state and bootstrap user profile / role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const profile = await ensureUserProfile(user);
          setUserRole(profile.role);
        } catch (err) {
          console.warn('Could not determine user profile/role:', err);
          const isBootAdmin = user.email?.toLowerCase() === 't18.sitic@gmail.com';
          setUserRole(isBootAdmin ? 'admin' : 'operador');
        }
      } else {
        setUserRole('operador');
      }
    });

    return () => unsubscribe();
  }, []);

  // Subscribe in real time to Firestore orders based on user role
  useEffect(() => {
    if (!currentUser) {
      setFirestoreOrders([]);
      return;
    }

    const unsubOrders = subscribeToFirestoreOrders(
      currentUser,
      userRole,
      (records) => {
        setFirestoreOrders(records);
        setFirestoreConnected(true);
      },
      (err) => {
        console.warn('Firestore subscription error:', err);
      }
    );

    return () => unsubOrders();
  }, [currentUser, userRole]);

  // Verify secondary Google Sheets status
  const checkSheetsStatus = async () => {
    try {
      const cfgRes = await fetch('/api/config/status');
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        setSheetsConfig({
          spreadsheetId: cfgData.sheets?.spreadsheetId || '',
          sheetName: cfgData.sheets?.sheetName || 'Hoja 1',
          serviceAccountConfigured: Boolean(cfgData.sheets?.hasServiceAccount),
          serviceAccountEmail: cfgData.sheets?.serviceAccountEmail || null,
        });

        if (cfgData.sheets?.spreadsheetId) {
          const vRes = await fetch('/api/sheets/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              spreadsheetId: cfgData.sheets.spreadsheetId,
              sheetName: cfgData.sheets.sheetName,
            }),
          });
          if (vRes.ok) {
            const vData = await vRes.json();
            setSheetsConnected(Boolean(vData.connected && vData.headersMatch));
            return vData;
          }
        }
      }
    } catch (err) {
      console.warn('Could not verify sheets connection on load:', err);
    }
    return null;
  };

  useEffect(() => {
    checkSheetsStatus();
  }, []);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Error signing in:', err);
      alert(`Error al iniciar sesión con Google: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err: any) {
      console.error('Error signing out:', err);
    }
  };

  const handleOpenImageModal = (imageUrl: string, imageName: string, orderInfo?: any) => {
    setModalState({
      isOpen: true,
      imageUrl,
      imageName,
      orderInfo,
    });
  };

  const handleCloseImageModal = () => {
    setModalState({ isOpen: false });
  };

  const handleAddFiles = (files: FileList | File[]) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    Array.from(files).forEach((file) => {
      if (!allowedTypes.includes(file.type.toLowerCase())) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImages((prev) => [
          ...prev,
          {
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            file,
            name: file.name,
            size: file.size,
            mimeType: file.type,
            dataUrl,
            status: 'pending',
            ordersFoundCount: 0,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    setCurrentTab('upload');
  };

  const pendingCount = orders.filter((o) => !o.approved && !o.savedToFirestore && !o.savedToSheets).length;
  const approvedCount = orders.filter((o) => o.approved && !o.savedToFirestore && !o.savedToSheets).length;

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#202A3C] flex flex-col font-sans selection:bg-[#3478F6] selection:text-white antialiased">
      {/* Offline Status Toast */}
      <OfflineIndicator />

      {/* Top Mobile App Bar */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        firestoreConnected={firestoreConnected}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      {/* Main View Area - Mobile first single column */}
      <main className="flex-1 max-w-md md:max-w-4xl w-full mx-auto px-3.5 sm:px-6 pt-4 pb-24">
        {currentTab === 'home' && (
          <HomeTab
            orders={orders}
            images={images}
            firestoreConnected={firestoreConnected}
            currentUser={currentUser}
            firestoreSavedCount={firestoreOrders.length}
            onLogin={handleLogin}
            onNavigate={(tab) => setCurrentTab(tab)}
            onAddSampleImages={(newImgs) => setImages((prev) => [...prev, ...newImgs])}
            onAddFilesToQueue={handleAddFiles}
          />
        )}

        {currentTab === 'upload' && (
          <UploadTab
            images={images}
            setImages={setImages}
            orders={orders}
            setOrders={setOrders}
            onOpenImageModal={handleOpenImageModal}
            onNavigateToReview={() => setCurrentTab('review')}
          />
        )}

        {currentTab === 'review' && (
          <ReviewTab
            orders={orders}
            setOrders={setOrders}
            currentUser={currentUser}
            firestoreConnected={firestoreConnected}
            sheetsConnected={sheetsConnected}
            onLogin={handleLogin}
            onOpenImageModal={handleOpenImageModal}
            onNavigateToConfig={() => setCurrentTab('config')}
            onSaveSuccess={(_count) => {
              // Real-time listener automatically populates firestoreOrders
            }}
          />
        )}

        {currentTab === 'history' && (
          <HistoryTab
            firestoreOrders={firestoreOrders}
            currentUser={currentUser}
            userRole={userRole}
            sheetsConfig={sheetsConfig}
          />
        )}

        {currentTab === 'config' && (
          <ConfigTab
            currentUser={currentUser}
            userRole={userRole}
            firestoreConnected={firestoreConnected}
            sheetsConfig={sheetsConfig}
            onConfigUpdated={(newCfg) => {
              setSheetsConfig({
                spreadsheetId: newCfg.spreadsheetId || '',
                sheetName: newCfg.sheetName || 'Hoja 1',
                serviceAccountConfigured: Boolean(newCfg.hasServiceAccount),
                serviceAccountEmail: newCfg.serviceAccountEmail || null,
              });
            }}
            onVerifyConnection={async () => {
              const res = await fetch('/api/sheets/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  spreadsheetId: sheetsConfig.spreadsheetId,
                  sheetName: sheetsConfig.sheetName,
                }),
              });
              const data = await res.json();
              setSheetsConnected(Boolean(data.connected && data.headersMatch));
              return data;
            }}
            onBackToHome={() => setCurrentTab('home')}
            onLogin={handleLogin}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Persistent Mobile Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        pendingCount={pendingCount}
        approvedCount={approvedCount}
      />

      {/* Touch-Friendly Image Inspection Modal */}
      <ImageModal
        isOpen={modalState.isOpen}
        onClose={handleCloseImageModal}
        imageUrl={modalState.imageUrl}
        imageName={modalState.imageName}
        orderInfo={modalState.orderInfo}
      />
    </div>
  );
}
