import React, { useRef, useState } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Trash2,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Eye,
  Layers,
  Sparkles,
  Plus,
} from 'lucide-react';
import { ImageUploadItem, TechnicalOrder } from '../types/order.js';
import { generateSampleOrderImage } from '../utils/sampleData.js';

interface UploadTabProps {
  images: ImageUploadItem[];
  setImages: React.Dispatch<React.SetStateAction<ImageUploadItem[]>>;
  orders: TechnicalOrder[];
  setOrders: React.Dispatch<React.SetStateAction<TechnicalOrder[]>>;
  onOpenImageModal: (imageUrl: string, imageName: string) => void;
  onNavigateToReview: () => void;
}

export const UploadTab: React.FC<UploadTabProps> = ({
  images,
  setImages,
  orders,
  setOrders,
  onOpenImageModal,
  onNavigateToReview,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const validateAndAddFiles = (files: FileList | File[]) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const MAX_SIZE_MB = 20;
    const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;

    Array.from(files).forEach((file) => {
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        alert(`El archivo "${file.name}" no es compatible. Solo se admiten formatos JPG, JPEG, PNG y WEBP.`);
        return;
      }

      if (file.size > MAX_BYTES) {
        alert(`El archivo "${file.name}" supera el tamaño límite de ${MAX_SIZE_MB}MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const item: ImageUploadItem = {
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          file,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          dataUrl,
          status: 'pending',
          ordersFoundCount: 0,
        };
        setImages((prev) => [...prev, item]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (imageId: string) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    setOrders((prev) => prev.filter((ord) => ord.imageId !== imageId || ord.savedToFirestore || ord.savedToSheets));
  };

  const processSingleImage = async (image: ImageUploadItem): Promise<boolean> => {
    setImages((prev) =>
      prev.map((img) => (img.id === image.id ? { ...img, status: 'processing', errorMessage: undefined } : img))
    );

    try {
      const response = await fetch('/api/ocr/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: image.dataUrl,
          mimeType: image.mimeType,
          filename: image.name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error del servidor HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.warningMessage || 'Error al procesar el reconocimiento óptico');
      }

      const extractedOrders = result.orders || [];

      const newOrders: TechnicalOrder[] = extractedOrders.map((ord: any, idx: number) => ({
        id: `ord-${Date.now()}-${image.id}-${idx}`,
        imageId: image.id,
        imageName: image.name,
        imageDataUrl: image.dataUrl,
        detectedAt: new Date().toLocaleTimeString(),
        approved: false, // Strict: user approval mandatory
        savedToSheets: false,
        fecha: ord.fecha || '',
        tecnico: ord.tecnico || '',
        tipo: ord.tipo || '',
        codigo: ord.codigo || '',
        ot: ord.ot || '',
        nombres: ord.nombres || '',
        ordenPhoenix: ord.ordenPhoenix || '',
        nodo: ord.nodo || '',
        estado: ord.estado || '',
        observacion: '', // Strictly empty
        confidence: ord.confidence || 'medium',
        warnings: ord.warnings || [],
        fieldStatus: ord.fieldStatus || {
          fecha: ord.fecha ? 'valid' : 'empty',
          tecnico: ord.tecnico ? 'valid' : 'empty',
          tipo: ord.tipo ? 'valid' : 'empty',
          codigo: ord.codigo ? 'valid' : 'empty',
          ot: ord.ot ? 'valid' : 'empty',
          nombres: ord.nombres ? 'valid' : 'empty',
          ordenPhoenix: ord.ordenPhoenix ? 'valid' : 'empty',
          nodo: ord.nodo ? 'valid' : 'empty',
          estado: ord.estado ? 'valid' : 'empty',
        },
        hasMultipleOrdersInImage: extractedOrders.length > 1,
      }));

      setOrders((prev) => {
        const filtered = prev.filter((o) => o.imageId !== image.id || o.savedToFirestore || o.savedToSheets);
        return [...filtered, ...newOrders];
      });

      setImages((prev) =>
        prev.map((img) =>
          img.id === image.id
            ? {
                ...img,
                status: 'completed',
                isBlurry: result.isBlurry,
                warningMessage: result.isBlurry ? result.warningMessage : undefined,
                ordersFoundCount: newOrders.length,
                processedAt: new Date().toLocaleTimeString(),
              }
            : img
        )
      );

      return true;
    } catch (error: any) {
      console.error(`Error processing image ${image.name}:`, error);
      setImages((prev) =>
        prev.map((img) =>
          img.id === image.id
            ? {
                ...img,
                status: 'error',
                errorMessage: error.message || 'No se pudo leer la orden técnica.',
              }
            : img
        )
      );
      return false;
    }
  };

  const handleProcessBatch = async () => {
    const pendingImages = images.filter((img) => img.status === 'pending' || img.status === 'error');
    if (pendingImages.length === 0) return;

    setIsProcessingBatch(true);
    setBatchProgress({ current: 0, total: pendingImages.length });

    for (let i = 0; i < pendingImages.length; i++) {
      setBatchProgress({ current: i + 1, total: pendingImages.length });
      await processSingleImage(pendingImages[i]);
    }

    setIsProcessingBatch(false);
    setBatchProgress(null);
  };

  const pendingCount = images.filter((img) => img.status === 'pending').length;
  const completedCount = images.filter((img) => img.status === 'completed').length;
  const totalOrdersExtracted = orders.length;

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Top Mobile Action Header */}
      <div className="bg-white border border-[#E3E8F0] rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-[#202A3C]">Cargar Fotografías</h2>
            <p className="text-xs text-[#718096]">Formatos JPG, PNG, WEBP (hasta 20MB)</p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F5F7FA] text-[#718096] border border-[#E3E8F0]">
            {images.length} fotos
          </span>
        </div>

        {/* Big Mobile Thumb Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="py-3 px-3 bg-[#3478F6] active:bg-[#2563EB] text-white font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-xs transition-transform active:scale-[0.98]"
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span>Cámara</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="py-3 px-3 bg-[#F5F7FA] hover:bg-[#EBF2FE] text-[#202A3C] border border-[#E3E8F0] font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 transition-colors active:scale-[0.98]"
          >
            <ImageIcon className="w-4 h-4 text-[#718096] shrink-0" />
            <span>Galería</span>
          </button>
        </div>
      </div>

      {/* Batch Processing CTA Bar */}
      {images.length > 0 && (
        <div className="space-y-2">
          {pendingCount > 0 && (
            <button
              onClick={handleProcessBatch}
              disabled={isProcessingBatch}
              className="w-full py-3.5 px-4 bg-[#3478F6] hover:bg-[#2563EB] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-sm transition-transform active:scale-[0.99] disabled:opacity-50"
            >
              {isProcessingBatch ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    Procesando {batchProgress?.current} de {batchProgress?.total}...
                  </span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Procesar {pendingCount} fotos con Gemini</span>
                </>
              )}
            </button>
          )}

          {totalOrdersExtracted > 0 && (
            <button
              onClick={onNavigateToReview}
              className="w-full py-3 px-4 bg-[#16A878] hover:bg-[#128C63] text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs transition-transform active:scale-[0.99]"
            >
              <span>Ir a Revisión ({totalOrdersExtracted} órdenes)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && (
        <div className="bg-white border border-[#E3E8F0] rounded-2xl p-8 text-center shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#EBF2FE] flex items-center justify-center text-[#3478F6] mb-3">
            <Camera className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm text-[#202A3C]">No hay fotos en la cola</h3>
          <p className="text-xs text-[#718096] mt-1 max-w-xs mx-auto">
            Usa los botones superiores para fotografiar órdenes de trabajo o seleccionarlas de tu galería.
          </p>
        </div>
      )}

      {/* Mobile Card List of Images in Queue */}
      <div className="space-y-3">
        {images.map((img) => (
          <div
            key={img.id}
            className="bg-white border border-[#E3E8F0] rounded-2xl p-3 shadow-xs flex items-center space-x-3 transition-all"
          >
            {/* Thumbnail with tap to view */}
            <div
              onClick={() => onOpenImageModal(img.dataUrl, img.name)}
              className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-[#F5F7FA] border border-[#E3E8F0] shrink-0 cursor-pointer"
            >
              <img
                src={img.dataUrl}
                alt={img.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Eye className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* Info and Actions */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h4 className="font-semibold text-xs text-[#202A3C] truncate" title={img.name}>
                  {img.name}
                </h4>
                <button
                  onClick={() => handleRemoveImage(img.id)}
                  disabled={img.status === 'processing' || isProcessingBatch}
                  className="p-1 text-[#718096] hover:text-[#DC4545] rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center space-x-2 text-[10px] text-[#718096] mt-0.5">
                <span>{(img.size / (1024 * 1024)).toFixed(2)} MB</span>
                {img.processedAt && <span>• {img.processedAt}</span>}
              </div>

              {/* Status Pills */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {img.status === 'pending' && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#FFF4D6] text-[#8A6100] border border-[#FFE7A3]">
                    Pendiente
                  </span>
                )}
                {img.status === 'processing' && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#EBF2FE] text-[#3478F6] border border-[#D0E2FF] flex items-center space-x-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    <span>Extrayendo con Gemini...</span>
                  </span>
                )}
                {img.status === 'completed' && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#E6F7F1] text-[#16A878] border border-[#B6EAD7] flex items-center space-x-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>
                      {img.ordersFoundCount === 1 ? '1 orden' : `${img.ordersFoundCount} órdenes`}
                    </span>
                  </span>
                )}
                {img.status === 'error' && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#FDECEC] text-[#DC4545] border border-[#F8BDBD]">
                    Error OCR
                  </span>
                )}
                {img.isBlurry && (
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[#FFF4D6] text-[#8A6100]">
                    Baja nitidez
                  </span>
                )}
              </div>

              {/* Error or warning notes */}
              {img.errorMessage && (
                <p className="text-[10px] text-[#DC4545] mt-1 leading-tight">{img.errorMessage}</p>
              )}
            </div>

            {/* Quick individual run button */}
            <div className="shrink-0 flex items-center">
              {img.status === 'pending' && (
                <button
                  onClick={() => processSingleImage(img)}
                  disabled={isProcessingBatch}
                  className="p-2 bg-[#EBF2FE] hover:bg-[#3478F6] text-[#3478F6] hover:text-white rounded-xl transition-colors"
                  title="Procesar individual"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
              {(img.status === 'completed' || img.status === 'error') && (
                <button
                  onClick={() => processSingleImage(img)}
                  disabled={isProcessingBatch}
                  className="p-2 bg-[#F5F7FA] hover:bg-[#E3E8F0] text-[#718096] rounded-xl transition-colors"
                  title="Reintentar OCR"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
