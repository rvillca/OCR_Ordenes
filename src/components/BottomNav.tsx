import React from 'react';
import { Home, Camera, CheckSquare, Clock } from 'lucide-react';

interface BottomNavProps {
  currentTab: 'home' | 'upload' | 'review' | 'history' | 'config';
  setCurrentTab: (tab: 'home' | 'upload' | 'review' | 'history' | 'config') => void;
  pendingCount: number;
  approvedCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  setCurrentTab,
  pendingCount,
  approvedCount,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E3E8F0] shadow-[0_-2px_10px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-around">
        {/* Inicio */}
        <button
          onClick={() => setCurrentTab('home')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
            currentTab === 'home' ? 'text-[#3478F6]' : 'text-[#718096] hover:text-[#202A3C]'
          }`}
        >
          <div
            className={`w-10 h-7 rounded-full flex items-center justify-center transition-all ${
              currentTab === 'home' ? 'bg-[#EBF2FE]' : ''
            }`}
          >
            <Home className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-medium mt-0.5">Inicio</span>
        </button>

        {/* Cargar */}
        <button
          onClick={() => setCurrentTab('upload')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
            currentTab === 'upload' ? 'text-[#3478F6]' : 'text-[#718096] hover:text-[#202A3C]'
          }`}
        >
          <div
            className={`w-10 h-7 rounded-full flex items-center justify-center transition-all ${
              currentTab === 'upload' ? 'bg-[#EBF2FE]' : ''
            }`}
          >
            <Camera className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-medium mt-0.5">Cargar</span>
        </button>

        {/* Revisión */}
        <button
          onClick={() => setCurrentTab('review')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
            currentTab === 'review' ? 'text-[#3478F6]' : 'text-[#718096] hover:text-[#202A3C]'
          }`}
        >
          <div
            className={`w-10 h-7 rounded-full flex items-center justify-center transition-all relative ${
              currentTab === 'review' ? 'bg-[#EBF2FE]' : ''
            }`}
          >
            <CheckSquare className="w-5 h-5" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#D97706] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center shadow-xs">
                {pendingCount}
              </span>
            )}
            {pendingCount === 0 && approvedCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#16A878] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center shadow-xs">
                {approvedCount}
              </span>
            )}
          </div>
          <span className="text-[11px] font-medium mt-0.5">Revisión</span>
        </button>

        {/* Historial */}
        <button
          onClick={() => setCurrentTab('history')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
            currentTab === 'history' ? 'text-[#3478F6]' : 'text-[#718096] hover:text-[#202A3C]'
          }`}
        >
          <div
            className={`w-10 h-7 rounded-full flex items-center justify-center transition-all ${
              currentTab === 'history' ? 'bg-[#EBF2FE]' : ''
            }`}
          >
            <Clock className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-medium mt-0.5">Historial</span>
        </button>
      </div>
    </nav>
  );
};
