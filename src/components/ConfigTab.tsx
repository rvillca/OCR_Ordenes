import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Key,
  Copy,
  Check,
  RefreshCw,
  ArrowLeft,
  Database,
  User as UserIcon,
  Shield,
  ShieldCheck,
  Users,
  Smartphone,
  Download,
  Info,
} from 'lucide-react';
import { REQUIRED_COLUMNS } from '../types/order.js';
import { User } from 'firebase/auth';
import { fetchAllUsers, updateUserRole, testFirestoreConnection } from '../services/firebase.js';
import { PWAInstallButton } from './PWAInstallButton.js';
import firebaseConfig from '../../firebase-applet-config.json';

interface ConfigTabProps {
  currentUser: User | null;
  userRole: 'admin' | 'operador';
  firestoreConnected: boolean;
  sheetsConfig: {
    spreadsheetId: string;
    sheetName: string;
    serviceAccountConfigured: boolean;
    serviceAccountEmail: string | null;
  };
  onConfigUpdated: (config: any) => void;
  onVerifyConnection: () => Promise<any>;
  onBackToHome?: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

export const ConfigTab: React.FC<ConfigTabProps> = ({
  currentUser,
  userRole,
  firestoreConnected,
  sheetsConfig,
  onConfigUpdated,
  onVerifyConnection,
  onBackToHome,
  onLogin,
  onLogout,
}) => {
  const [spreadsheetInput, setSpreadsheetInput] = useState(sheetsConfig.spreadsheetId);
  const [sheetNameInput, setSheetNameInput] = useState(sheetsConfig.sheetName || 'Hoja 1');
  const [serviceAccountJsonInput, setServiceAccountJsonInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [isInitializingHeaders, setIsInitializingHeaders] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedColumns, setCopiedColumns] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Admin users list state
  const [userList, setUserList] = useState<
    Array<{ uid: string; email: string; displayName: string; role: 'admin' | 'operador'; createdAt: string }>
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updatingUserUid, setUpdatingUserUid] = useState<string | null>(null);

  const loadUsers = async () => {
    if (userRole === 'admin') {
      setLoadingUsers(true);
      try {
        const users = await fetchAllUsers();
        setUserList(users);
      } catch (err) {
        console.warn('Error fetching users:', err);
      } finally {
        setLoadingUsers(false);
      }
    }
  };

  useEffect(() => {
    if (userRole === 'admin') {
      loadUsers();
    }
  }, [userRole]);

  const handleRoleToggle = async (targetUid: string, targetEmail: string, currentTargetRole: 'admin' | 'operador') => {
    const newRole = currentTargetRole === 'admin' ? 'operador' : 'admin';
    if (!confirm(`¿Cambiar el rol de ${targetEmail} a ${newRole.toUpperCase()}?`)) {
      return;
    }

    setUpdatingUserUid(targetUid);
    try {
      await updateUserRole(targetUid, targetEmail, newRole);
      await loadUsers();
    } catch (err: any) {
      alert(`Error al actualizar rol: ${err.message}`);
    } finally {
      setUpdatingUserUid(null);
    }
  };

  const handleSaveConfig = async () => {
    try {
      let parsedJson = undefined;
      if (serviceAccountJsonInput.trim()) {
        try {
          parsedJson = JSON.parse(serviceAccountJsonInput);
        } catch {
          alert('El JSON de la Cuenta de Servicio no tiene un formato válido.');
          return;
        }
      }

      const res = await fetch('/api/config/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: spreadsheetInput,
          sheetName: sheetNameInput,
          serviceAccountJson: parsedJson,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al actualizar configuración');
      }

      onConfigUpdated(data.sheets);
      setSaveStatus('Configuración guardada.');
      setTimeout(() => setSaveStatus(null), 3000);

      handleVerify();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const result = await onVerifyConnection();
      setVerifyResult(result);
    } catch (error: any) {
      setVerifyResult({
        connected: false,
        message: error.message || 'Error al conectar con Google Sheets',
        headersMatch: false,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleInitHeaders = async () => {
    setIsInitializingHeaders(true);
    try {
      const res = await fetch('/api/sheets/init-headers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al inicializar encabezados');
      }
      alert('¡Encabezados oficiales inicializados correctamente en la fila 1!');
      handleVerify();
    } catch (error: any) {
      alert(`Error al inicializar: ${error.message}`);
    } finally {
      setIsInitializingHeaders(false);
    }
  };

  const handleCopyEmail = () => {
    if (sheetsConfig.serviceAccountEmail) {
      navigator.clipboard.writeText(sheetsConfig.serviceAccountEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const handleCopyColumns = () => {
    navigator.clipboard.writeText(REQUIRED_COLUMNS.join('\t'));
    setCopiedColumns(true);
    setTimeout(() => setCopiedColumns(false), 2000);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Mobile Top Navigation back */}
      {onBackToHome && (
        <button
          onClick={onBackToHome}
          className="flex items-center space-x-1.5 text-xs font-bold text-[#3478F6] active:translate-x-[-2px] transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Inicio</span>
        </button>
      )}

      {/* 1. User & Authentication Card */}
      <div className="bg-white border border-[#E3E8F0] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EBF2FE] text-[#3478F6] flex items-center justify-center shrink-0">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#202A3C]">Autenticación y Usuario</h2>
              <p className="text-xs text-[#718096]">Control de acceso seguro</p>
            </div>
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              userRole === 'admin'
                ? 'bg-[#EBF2FE] text-[#3478F6] border-[#D0E2FF]'
                : 'bg-[#F5F7FA] text-[#718096] border-[#E3E8F0]'
            }`}
          >
            {userRole === 'admin' ? 'Administrador' : 'Operador'}
          </span>
        </div>

        {currentUser ? (
          <div className="p-3 bg-[#F8FAFD] border border-[#E3E8F0] rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5 min-w-0">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || ''}
                  className="w-8 h-8 rounded-full border border-[#E3E8F0] shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#3478F6] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {currentUser.email?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-xs text-[#202A3C] truncate">{currentUser.displayName || 'Usuario'}</p>
                <p className="text-[11px] text-[#718096] truncate">{currentUser.email}</p>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="px-2.5 py-1.5 text-xs font-semibold text-[#DC4545] hover:bg-[#FDECEC] border border-transparent rounded-lg shrink-0 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        ) : (
          <div className="p-3 bg-[#FFF4D6] border border-[#FFE7A3] rounded-xl flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-[#8A6100]">Sesión no iniciada</p>
              <p className="text-[11px] text-[#8A6100]">Inicia sesión con Google para guardar órdenes en Firestore.</p>
            </div>
            <button
              onClick={onLogin}
              className="px-3 py-1.5 bg-[#3478F6] text-white text-xs font-bold rounded-lg shrink-0 shadow-2xs hover:bg-[#2563EB]"
            >
              Acceder
            </button>
          </div>
        )}
      </div>

      {/* 2. Cloud Firestore Platform Status */}
      <div className="bg-white border border-[#E3E8F0] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E6F7F1] text-[#16A878] flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#202A3C]">Base de Datos Principal</h2>
              <p className="text-xs text-[#718096]">Google Cloud Firestore</p>
            </div>
          </div>

          <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E6F7F1] text-[#16A878] border border-[#B6EAD7]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A878]" />
            <span>Conectado</span>
          </span>
        </div>

        <div className="p-3 bg-[#F8FAFD] border border-[#E3E8F0] rounded-xl space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[#718096]">Proyecto Firebase:</span>
            <span className="font-mono font-bold text-[#202A3C]">{firebaseConfig.projectId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#718096]">ID Base de Datos:</span>
            <span className="font-mono text-[11px] text-[#202A3C] truncate max-w-[200px]">
              {firebaseConfig.firestoreDatabaseId}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#718096]">Reglas de Seguridad:</span>
            <span className="text-[#16A878] font-semibold flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Protegidas (ABAC)</span>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Admin Panel (Only for Administrators) */}
      {userRole === 'admin' && (
        <div className="bg-white border border-[#E3E8F0] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#EBF2FE] text-[#3478F6] flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#202A3C]">Panel de Administrador</h2>
                <p className="text-xs text-[#718096]">Gestión de operadores y roles</p>
              </div>
            </div>

            <button
              onClick={loadUsers}
              disabled={loadingUsers}
              className="p-1.5 rounded-lg text-[#718096] hover:bg-[#F5F7FA]"
              title="Recargar usuarios"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <p className="text-xs text-[#718096]">
            Como administrador puedes ver todas las órdenes de los operadores y promover o revocar permisos.
          </p>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {userList.map((u) => (
              <div
                key={u.uid}
                className="p-2.5 bg-[#F8FAFD] border border-[#E3E8F0] rounded-xl flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-[#202A3C] truncate">{u.displayName}</p>
                  <p className="text-[11px] text-[#718096] truncate">{u.email}</p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      u.role === 'admin'
                        ? 'bg-[#EBF2FE] text-[#3478F6] border border-[#D0E2FF]'
                        : 'bg-[#F5F7FA] text-[#718096] border border-[#E3E8F0]'
                    }`}
                  >
                    {u.role.toUpperCase()}
                  </span>

                  {u.email !== 't18.sitic@gmail.com' && (
                    <button
                      onClick={() => handleRoleToggle(u.uid, u.email, u.role)}
                      disabled={updatingUserUid === u.uid}
                      className="text-[11px] font-semibold text-[#3478F6] hover:underline"
                    >
                      {u.role === 'admin' ? 'Hacer Operador' : 'Hacer Admin'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. PWA Installation & Offline */}
      <div className="bg-white border border-[#E3E8F0] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#F5F7FA] text-[#202A3C] flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#202A3C]">Aplicación Web Progresiva (PWA)</h2>
            <p className="text-xs text-[#718096]">Instalación en celular y soporte sin conexión</p>
          </div>
        </div>

        <p className="text-xs text-[#718096] leading-relaxed">
          Instala la aplicación en tu pantalla de inicio para acceder rápidamente desde terreno, con diseño optimizado para usar con una mano.
        </p>

        <PWAInstallButton />
      </div>

      {/* 5. Google Sheets Secondary Integration */}
      <div className="bg-white border border-[#E3E8F0] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EBF2FE] text-[#3478F6] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#202A3C]">Google Sheets (Sincronización Opcional)</h2>
              <p className="text-xs text-[#718096]">Destino secundario para exportación de respaldo</p>
            </div>
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              sheetsConfig.spreadsheetId
                ? 'bg-[#E6F7F1] text-[#16A878] border-[#B6EAD7]'
                : 'bg-[#F5F7FA] text-[#718096] border-[#E3E8F0]'
            }`}
          >
            {sheetsConfig.spreadsheetId ? 'Configurado' : 'Google Sheets no configurado'}
          </span>
        </div>

        {/* Informative non-blocking banner */}
        <div className="p-3 bg-[#F8FAFD] border border-[#E3E8F0] rounded-xl text-xs text-[#718096] space-y-1">
          <p className="font-semibold text-[#202A3C]">
            💡 Integración secundaria opcional
          </p>
          <p className="leading-relaxed">
            La aplicación almacena y gestiona las órdenes de trabajo directamente en <strong>Cloud Firestore</strong> y <strong>Firebase Authentication</strong>. La configuración de Google Sheets no es obligatoria para el funcionamiento de la aplicación ni para el OCR.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-[#202A3C] mb-1">
              ID o Enlace de la Hoja:
            </label>
            <input
              type="text"
              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
              value={spreadsheetInput}
              onChange={(e) => setSpreadsheetInput(e.target.value)}
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E3E8F0] rounded-xl text-xs text-[#202A3C] placeholder-[#A0AEC0] focus:outline-none focus:border-[#3478F6] focus:bg-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#202A3C] mb-1">
              Pestaña (Hoja):
            </label>
            <input
              type="text"
              placeholder="Hoja 1"
              value={sheetNameInput}
              onChange={(e) => setSheetNameInput(e.target.value)}
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E3E8F0] rounded-xl text-xs text-[#202A3C] focus:outline-none focus:border-[#3478F6] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#202A3C] mb-1">
              Cuenta de Servicio JSON (Opcional):
            </label>
            <textarea
              rows={2}
              placeholder='Pegar JSON de la Cuenta de Servicio si deseas que el servidor escriba automáticamente en Google Sheets...'
              value={serviceAccountJsonInput}
              onChange={(e) => setServiceAccountJsonInput(e.target.value)}
              className="w-full px-3 py-2 bg-[#F5F7FA] border border-[#E3E8F0] rounded-xl text-xs text-[#202A3C] placeholder-[#A0AEC0] focus:outline-none focus:border-[#3478F6] focus:bg-white font-mono"
            />
          </div>
        </div>

        {/* Verification result display */}
        {verifyResult && (
          <div
            className={`p-3 rounded-xl border text-xs space-y-2 ${
              verifyResult.connected && verifyResult.headersMatch
                ? 'bg-[#E6F7F1] border-[#B6EAD7] text-[#16A878]'
                : verifyResult.connected
                ? 'bg-[#FFF4D6] border-[#FFE7A3] text-[#8A6100]'
                : 'bg-[#FDECEC] border-[#F8BDBD] text-[#DC4545]'
            }`}
          >
            <div className="flex items-start space-x-2">
              {verifyResult.connected && verifyResult.headersMatch ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="font-semibold">{verifyResult.message}</span>
            </div>

            {verifyResult.connected && !verifyResult.headersMatch && (
              <div className="pt-2 border-t border-[#FFE7A3] flex items-center justify-between gap-2">
                <span className="text-[11px]">¿Escribir los 10 encabezados en la Fila 1?</span>
                <button
                  onClick={handleInitHeaders}
                  disabled={isInitializingHeaders}
                  className="px-2.5 py-1 bg-[#D97706] text-white font-bold rounded-lg text-xs shrink-0"
                >
                  {isInitializingHeaders ? 'Escribiendo...' : 'Inicializar'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleSaveConfig}
            className="py-2.5 px-3 bg-[#3478F6] active:bg-[#2563EB] text-white font-semibold rounded-xl text-xs shadow-xs text-center"
          >
            Guardar
          </button>

          <button
            onClick={handleVerify}
            disabled={isVerifying || !spreadsheetInput.trim()}
            className="py-2.5 px-3 bg-[#F5F7FA] text-[#202A3C] border border-[#E3E8F0] font-semibold rounded-xl text-xs flex items-center justify-center space-x-1.5 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin text-[#3478F6]' : ''}`} />
            <span>{isVerifying ? 'Verificando...' : 'Verificar'}</span>
          </button>
        </div>

        {saveStatus && <p className="text-xs text-[#16A878] font-semibold text-center">{saveStatus}</p>}
      </div>

      {/* 6. Official 10 Columns list */}
      <div className="bg-white border border-[#E3E8F0] rounded-2xl p-4 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs text-[#202A3C]">10 Columnas Oficiales Normativas</h3>
          <button
            onClick={handleCopyColumns}
            className="text-xs text-[#3478F6] font-semibold"
          >
            {copiedColumns ? '¡Copiadas!' : 'Copiar'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
          {REQUIRED_COLUMNS.map((col, idx) => (
            <div
              key={col}
              className={`p-1.5 rounded-lg border text-center truncate ${
                col === 'OBSERVACION'
                  ? 'bg-[#F5F7FA] text-[#A0AEC0] italic'
                  : col === 'OT' || col === 'N° ORDEN PHOENIX'
                  ? 'bg-[#EBF2FE] border-[#D0E2FF] text-[#3478F6] font-bold'
                  : 'bg-white border-[#E3E8F0] text-[#202A3C]'
              }`}
            >
              {idx + 1}. {col}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
