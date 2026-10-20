import React, { useRef } from 'react';
import {
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  Layers,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  LogIn,
} from 'lucide-react';
import { TechnicalOrder, ImageUploadItem } from '../types/order.js';
import { generateSampleOrderImage } from '../utils/sampleData.js';
import { User } from 'firebase/auth';

interface HomeTabProps {
  orders: TechnicalOrder[];
  images: ImageUploadItem[];
  firestoreConnected: boolean;
  currentUser: User | null;
  firestoreSavedCount: number;
  onLogin: () => void;
  onNavigate: (tab: 'home' | 'upload' | 'review' | 'history' | 'config') => void;
  onAddSampleImages: (newImages: ImageUploadItem[]) => void;
  onAddFilesToQueue: (files: FileList | File[]) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  orders,
  images,
  firestoreConnected,
  currentUser,
  firestoreSavedCount,
  onLogin,
  onNavigate,
  onAddSampleImages,
  onAddFilesToQueue,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const totalImages = images.length;
  const pendingReview = orders.filter((o) => !o.approved && !o.savedToFirestore && !o.savedToSheets).length;
  const approvedOrders = orders.filter((o) => o.approved && !o.savedToFirestore && !o.savedToSheets).length;

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFilesToQueue(e.target.files);
      e.target.value = '';
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFilesToQueue(e.target.files);
      e.target.value = '';
    }
  };

  const handleLoadSample = async (type: 'single' | 'double' | 'blurry') => {
    const sample = await generateSampleOrderImage(type);
    const newImage: ImageUploadItem = {
      id: `sample-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: sample.name,
      size: Math.round(sample.base64.length * 0.75),
      mimeType: 'image/jpeg',
      dataUrl: sample.base64,
      status: 'pending',
      ordersFoundCount: 0,
    };
    onAddSampleImages([newImage]);
    onNavigate('upload');
  };

  return (
    <div className="space-y-4">
      {/* Hidden file inputs for direct camera / gallery capture */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,image/*"
        className="hidden"
        onChange={handleGalleryChange}
      />

      {/* Auth Banner if not authenticated */}
      {!currentUser && (
        <div className="bg-[#EBF2FE] border border-[#D0E2FF] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#3478F6] text-white flex items-center justify-center shrink-0">
              <LogIn className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#202A3C]">Autenticación con Firebase</p>
              <p className="text-[11px] text-[#718096]">
                Inicia sesión con tu cuenta de Google para guardar tus órdenes en Cloud Firestore
              </p>
            </div>
          </div>
          <button
            onClick={onLogin}
            className="w-full sm:w-auto px-4 py-2 bg-[#3478F6] hover:bg-[#2563EB] text-white text-xs font-bold rounded-xl shrink-0 shadow-xs"
          >
            Acceder con Google
          </button>
        </div>
      )}

      {/* Main card: "¿Qué vamos a registrar hoy?" */}
      <div className="bg-white border border-[#E3E8F0] rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center space-x-2 text-[#3478F6] text-xs font-semibold mb-1">
          <Sparkles className="w-4 h-4" />
          <span>DIGITALIZACIÓN RÁPIDA PWA</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#202A3C] tracking-tight">
          ¿Qué vamos a registrar hoy?
        </h2>
        <p className="text-xs sm:text-sm text-[#718096] mt-1 leading-relaxed">
          Fotografía las órdenes de trabajo técnicas para extraer los datos con Gemini y almacenarlas en Cloud Firestore.
        </p>

        {/* Primary Thumb Actions (Tomar fotografía & Elegir desde galería) */}
        <div className="mt-5 space-y-2.5">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-full py-3.5 px-4 bg-[#3478F6] active:bg-[#2563EB] text-white font-semibold rounded-xl text-sm flex items-center justify-center space-x-2.5 shadow-sm transition-transform active:scale-[0.98]"
          >
            <Camera className="w-5 h-5" />
            <span>Tomar fotografía</span>
          </button>

          <button
            onClick={() => galleryInputRef.current?.click()}
            className="w-full py-3 px-4 bg-[#F5F7FA] hover:bg-[#EBF2FE] text-[#202A3C] border border-[#E3E8F0] font-medium rounded-xl text-sm flex items-center justify-center space-x-2.5 transition-colors"
          >
            <ImageIcon className="w-4 h-4 text-[#718096]" />
            <span>Elegir desde galería</span>
          </button>
        </div>
      </div>

      {/* Section: "Resumen de hoy" with compact cards */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#718096]">
            Resumen de hoy
          </h3>
          {pendingReview > 0 && (
            <button
              onClick={() => onNavigate('review')}
              className="text-xs text-[#3478F6] font-semibold flex items-center space-x-0.5"
            >
              <span>Revisar</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Por revisar */}
          <div
            onClick={() => onNavigate('review')}
            className="bg-white border border-[#E3E8F0] p-3.5 rounded-xl shadow-xs cursor-pointer active:bg-[#F5F7FA] transition-colors"
          >
            <div className="flex items-center justify-between text-[#718096] mb-1">
              <span className="text-[11px] font-medium">Por revisar</span>
              <AlertCircle className="w-4 h-4 text-[#D97706]" />
            </div>
            <div className="text-2xl font-bold text-[#D97706] tracking-tight">{pendingReview}</div>
            <p className="text-[10px] text-[#718096] mt-0.5">Requieren aprobación</p>
          </div>

          {/* Aprobadas */}
          <div
            onClick={() => onNavigate('review')}
            className="bg-white border border-[#E3E8F0] p-3.5 rounded-xl shadow-xs cursor-pointer active:bg-[#F5F7FA] transition-colors"
          >
            <div className="flex items-center justify-between text-[#718096] mb-1">
              <span className="text-[11px] font-medium">Aprobadas</span>
              <CheckCircle2 className="w-4 h-4 text-[#3478F6]" />
            </div>
            <div className="text-2xl font-bold text-[#3478F6] tracking-tight">{approvedOrders}</div>
            <p className="text-[10px] text-[#718096] mt-0.5">Listas para guardar</p>
          </div>

          {/* Guardadas en Firestore */}
          <div
            onClick={() => onNavigate('history')}
            className="bg-white border border-[#E3E8F0] p-3.5 rounded-xl shadow-xs cursor-pointer active:bg-[#F5F7FA] transition-colors"
          >
            <div className="flex items-center justify-between text-[#718096] mb-1">
              <span className="text-[11px] font-medium">En Firestore</span>
              <Database className="w-4 h-4 text-[#16A878]" />
            </div>
            <div className="text-2xl font-bold text-[#16A878] tracking-tight">{firestoreSavedCount}</div>
            <p className="text-[10px] text-[#718096] mt-0.5">Base de datos en la nube</p>
          </div>

          {/* Fotos cargadas */}
          <div
            onClick={() => onNavigate('upload')}
            className="bg-white border border-[#E3E8F0] p-3.5 rounded-xl shadow-xs cursor-pointer active:bg-[#F5F7FA] transition-colors"
          >
            <div className="flex items-center justify-between text-[#718096] mb-1">
              <span className="text-[11px] font-medium">Fotos cargadas</span>
              <Layers className="w-4 h-4 text-[#718096]" />
            </div>
            <div className="text-2xl font-bold text-[#202A3C] tracking-tight">{totalImages}</div>
            <p className="text-[10px] text-[#718096] mt-0.5">En cola de trabajo</p>
          </div>
        </div>
      </div>

      {/* Section: "Prueba el sistema" with sample documents */}
      <div className="bg-white border border-[#E3E8F0] rounded-2xl p-4 sm:p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#718096] mb-1">
          Prueba el sistema
        </h3>
        <p className="text-xs text-[#718096] mb-3">
          ¿No tienes una orden física a mano? Carga una muestra sintética para probar el OCR:
        </p>

        <div className="space-y-2">
          <button
            onClick={() => handleLoadSample('single')}
            className="w-full p-3 bg-[#F8FAFD] hover:bg-[#F0F5FF] border border-[#E3E8F0] rounded-xl text-left flex items-center justify-between active:scale-[0.99] transition-all"
          >
            <div>
              <div className="text-xs font-bold text-[#202A3C]">Orden FTTH Simple</div>
              <div className="text-[11px] text-[#718096]">OT-104928, Phoenix PHX-9004128, nítida</div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#3478F6] shrink-0" />
          </button>

          <button
            onClick={() => handleLoadSample('double')}
            className="w-full p-3 bg-[#F8FAFD] hover:bg-[#F0F5FF] border border-[#E3E8F0] rounded-xl text-left flex items-center justify-between active:scale-[0.99] transition-all"
          >
            <div>
              <div className="text-xs font-bold text-[#202A3C]">Multi-Orden (2 en 1)</div>
              <div className="text-[11px] text-[#718096]">Planilla con dos órdenes para separar</div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#3478F6] shrink-0" />
          </button>

          <button
            onClick={() => handleLoadSample('blurry')}
            className="w-full p-3 bg-[#F8FAFD] hover:bg-[#FFF9EA] border border-[#E3E8F0] rounded-xl text-left flex items-center justify-between active:scale-[0.99] transition-all"
          >
            <div>
              <div className="text-xs font-bold text-[#8A6100]">Documento con Baja Nitidez</div>
              <div className="text-[11px] text-[#718096]">Comprueba la detección de campos dudosos</div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#8A6100] shrink-0" />
          </button>
        </div>
      </div>

      {/* Security note */}
      <div className="p-3 bg-[#F8FAFD] border border-[#E3E8F0] rounded-xl text-[11px] text-[#718096] flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-[#16A878] shrink-0" />
        <span>
          <strong>Garantía de Control:</strong> Ningún registro se guarda sin tu aprobación previa. La columna OBSERVACION permanece siempre vacía.
        </span>
      </div>
    </div>
  );
};
