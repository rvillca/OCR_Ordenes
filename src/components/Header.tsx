import React from 'react';
import { Database, ScanLine, Settings, User as UserIcon, LogIn, LogOut } from 'lucide-react';
import { User } from 'firebase/auth';

interface HeaderProps {
  currentTab: 'home' | 'upload' | 'review' | 'history' | 'config';
  setCurrentTab: (tab: 'home' | 'upload' | 'review' | 'history' | 'config') => void;
  firestoreConnected: boolean;
  currentUser: User | null;
  onLogin: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  firestoreConnected,
  currentUser,
  onLogin,
  onLogout,
}) => {
  return (
    <header className="bg-white border-b border-[#E3E8F0] sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <div className="max-w-md md:max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand / Logo */}
        <div
          className="flex items-center space-x-2.5 cursor-pointer select-none"
          onClick={() => setCurrentTab('home')}
        >
          <div className="w-8 h-8 rounded-lg bg-[#3478F6] flex items-center justify-center text-white shadow-xs">
            <ScanLine className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-base text-[#202A3C] tracking-tight leading-none">
              OCR Órdenes Técnicas
            </h1>
            <p className="text-[10px] text-[#718096] mt-0.5 leading-none">
              PWA • Cloud Firestore
            </p>
          </div>
        </div>

        {/* User Auth & Firestore Status */}
        <div className="flex items-center space-x-2">
          {/* Firestore status pill */}
          <button
            onClick={() => setCurrentTab('config')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              firestoreConnected
                ? 'bg-[#E6F7F1] text-[#16A878] border-[#B6EAD7]'
                : 'bg-[#FFF4D6] text-[#8A6100] border-[#FFE7A3]'
            }`}
            title="Estado de base de datos Cloud Firestore"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                firestoreConnected ? 'bg-[#16A878]' : 'bg-[#D97706]'
              }`}
            />
            <Database className="w-3 h-3" />
            <span className="hidden xs:inline">
              {firestoreConnected ? 'Firestore' : 'Conectando'}
            </span>
          </button>

          {/* User Sign in / Profile */}
          {currentUser ? (
            <div className="flex items-center space-x-1.5">
              <button
                onClick={onLogout}
                className="p-1 rounded-full border border-[#E3E8F0] hover:border-[#DC4545] text-[#718096] hover:text-[#DC4545] transition-colors"
                title={`Cerrar sesión (${currentUser.email})`}
              >
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Usuario'}
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#EBF2FE] text-[#3478F6] flex items-center justify-center font-bold text-xs">
                    {currentUser.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="px-2.5 py-1 rounded-lg bg-[#3478F6] text-white text-[11px] font-semibold flex items-center space-x-1 shadow-2xs hover:bg-[#2563EB] transition-colors"
              title="Iniciar sesión con Google"
            >
              <LogIn className="w-3 h-3" />
              <span>Acceder</span>
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={() => setCurrentTab(currentTab === 'config' ? 'home' : 'config')}
            className={`p-2 rounded-lg transition-colors ${
              currentTab === 'config'
                ? 'bg-[#EBF2FE] text-[#3478F6]'
                : 'text-[#718096] hover:text-[#202A3C] hover:bg-[#F5F7FA]'
            }`}
            title="Configuración"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
