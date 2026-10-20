import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, AlertTriangle, CheckCircle, FileText } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  imageName?: string;
  orderInfo?: {
    ot: string;
    ordenPhoenix: string;
    tecnico: string;
    nombres: string;
    warnings?: string[];
  };
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imageName,
  orderInfo,
}) => {
  const [scale, setScale] = useState(1);

  if (!isOpen || !imageUrl) return null;

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.3, 3.5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.3, 0.5));
  const handleResetZoom = () => setScale(1);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#202A3C]/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border-t sm:border border-[#E3E8F0] rounded-t-3xl sm:rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Header Bar */}
        <div className="px-4 py-3 bg-[#F8FAFD] border-b border-[#E3E8F0] flex items-center justify-between">
          <div className="flex items-center space-x-2 truncate">
            <div className="w-7 h-7 rounded-lg bg-[#EBF2FE] text-[#3478F6] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h3 className="font-bold text-xs sm:text-sm text-[#202A3C] truncate">
                {imageName || 'Fotografía de la orden'}
              </h3>
            </div>
          </div>

          {/* Controls & Close */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={handleZoomOut}
              className="p-1.5 bg-white border border-[#E3E8F0] text-[#718096] rounded-lg shadow-2xs"
              title="Alejar"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 py-1 bg-white border border-[#E3E8F0] text-[11px] font-mono text-[#718096] rounded-lg shadow-2xs"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1.5 bg-white border border-[#E3E8F0] text-[#718096] rounded-lg shadow-2xs"
              title="Acercar"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 bg-[#F5F7FA] text-[#202A3C] rounded-lg"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Canvas with Touch Scrolling / Dragging */}
        <div className="flex-1 overflow-auto bg-[#F5F7FA] p-3 flex items-center justify-center min-h-[300px] max-h-[60vh]">
          <div
            className="transition-transform duration-100 origin-center flex items-center justify-center"
            style={{ transform: `scale(${scale})` }}
          >
            <img
              src={imageUrl}
              alt={imageName || 'Documento'}
              className="max-h-[55vh] max-w-full object-contain rounded-xl shadow-xs border border-[#E3E8F0] bg-white"
            />
          </div>
        </div>

        {/* Order Details Footer */}
        {orderInfo && (
          <div className="px-4 py-3 bg-white border-t border-[#E3E8F0] space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center space-x-1.5">
                {orderInfo.ot && (
                  <span className="font-mono font-bold px-2 py-0.5 bg-[#EBF2FE] text-[#3478F6] rounded-md border border-[#D0E2FF]">
                    OT: {orderInfo.ot}
                  </span>
                )}
                {orderInfo.ordenPhoenix && (
                  <span className="font-mono px-2 py-0.5 bg-[#F5F3FF] text-[#5856D6] rounded-md border border-[#DDD6FE]">
                    PHX: {orderInfo.ordenPhoenix}
                  </span>
                )}
              </div>
              <span className="text-[#718096] text-[11px] truncate max-w-[150px]">
                {orderInfo.tecnico}
              </span>
            </div>
            {orderInfo.nombres && (
              <p className="font-medium text-[#202A3C] truncate">{orderInfo.nombres}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
