import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall.js';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-16 left-4 right-4 z-50 max-w-md mx-auto flex items-center justify-between gap-2 rounded-xl bg-[#D97706] text-white px-3.5 py-2 text-xs font-semibold shadow-lg">
      <div className="flex items-center space-x-2">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span>Sin conexión. Estás trabajando en modo sin conexión.</span>
      </div>
      <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
    </div>
  );
};
