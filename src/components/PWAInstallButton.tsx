import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.js';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed in standalone mode, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={
          compact
            ? "px-2.5 py-1 bg-[#3478F6] text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-2xs hover:bg-[#2563EB] transition-colors"
            : "w-full py-3 px-4 bg-[#3478F6] active:bg-[#2563EB] text-white font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-xs transition-transform active:scale-[0.98]"
        }
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar Aplicación (PWA)</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={
            compact
              ? "px-2.5 py-1 bg-[#F5F7FA] border border-[#E3E8F0] text-[#202A3C] rounded-lg text-xs font-semibold flex items-center space-x-1"
              : "w-full py-2.5 px-3 bg-[#F5F7FA] border border-[#E3E8F0] text-[#202A3C] rounded-xl text-xs font-semibold flex items-center justify-center space-x-2"
          }
        >
          <Smartphone className="w-3.5 h-3.5 text-[#3478F6]" />
          <span>Instalar en iPhone / iPad</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-[#E3E8F0] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#202A3C]">Instalar en iOS</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-[#718096] hover:bg-[#F5F7FA]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-[#718096] leading-relaxed">
                1. Toca el botón <strong>Compartir</strong> en la barra inferior de Safari.<br />
                2. Selecciona <strong>Agregar a pantalla de inicio</strong>.<br />
                3. Pulsa <strong>Agregar</strong> arriba a la derecha.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 bg-[#3478F6] text-white rounded-xl text-xs font-bold"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
