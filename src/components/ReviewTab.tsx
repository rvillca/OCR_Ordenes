import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Database,
  FileSpreadsheet,
  Trash2,
  Eye,
  CheckSquare,
  Square,
  Search,
  Download,
  Copy,
  Check,
  AlertCircle,
  Info,
  ShieldCheck,
  Loader2,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Table as TableIcon,
  LogIn,
  FileText,
} from 'lucide-react';
import { TechnicalOrder } from '../types/order.js';
import { exportOrdersToCsv, exportOrdersToExcel, copyOrdersToTsv } from '../utils/exportOrders.js';
import { saveApprovedOrdersToFirestore } from '../services/firebase.js';
import { User } from 'firebase/auth';

interface ReviewTabProps {
  orders: TechnicalOrder[];
  setOrders: React.Dispatch<React.SetStateAction<TechnicalOrder[]>>;
  currentUser: User | null;
  firestoreConnected: boolean;
  sheetsConnected: boolean;
  onLogin: () => void;
  onOpenImageModal: (imageUrl: string, imageName: string, orderInfo?: any) => void;
  onNavigateToConfig: () => void;
  onSaveSuccess: (count: number) => void;
}

export const ReviewTab: React.FC<ReviewTabProps> = ({
  orders,
  setOrders,
  currentUser,
  firestoreConnected,
  sheetsConnected,
  onLogin,
  onOpenImageModal,
  onNavigateToConfig,
  onSaveSuccess,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'saved' | 'warning'>('all');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [copiedTsv, setCopiedTsv] = useState(false);
  const [saveResultMessage, setSaveResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [desktopViewMode, setDesktopViewMode] = useState<'cards' | 'table'>('cards');

  const toggleCardExpanded = (orderId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleFieldChange = (orderId: string, field: keyof TechnicalOrder, value: string) => {
    if (field === 'observacion') return; // Strict empty

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;

        const updated = { ...ord, [field]: value };
        if (updated.fieldStatus && field in updated.fieldStatus) {
          updated.fieldStatus = {
            ...updated.fieldStatus,
            [field]: value.trim() ? 'valid' : 'empty',
          };
        }
        return updated;
      })
    );
  };

  const toggleApproval = (orderId: string) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          return { ...ord, approved: !ord.approved };
        }
        return ord;
      })
    );
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((ord) => ord.id !== orderId));
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const handleToggleSelect = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleBatchApprove = (approve: boolean) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (selectedOrderIds.has(ord.id) && !ord.savedToFirestore) {
          return { ...ord, approved: approve };
        }
        return ord;
      })
    );
  };

  // Primary operation: Save approved orders to Cloud Firestore
  const handleSaveToFirestore = async () => {
    const ordersToSave = orders.filter((o) => o.approved && !o.savedToFirestore);
    if (ordersToSave.length === 0) return;

    if (!currentUser) {
      alert('Debes iniciar sesión con tu cuenta de Google para guardar en Cloud Firestore.');
      onLogin();
      return;
    }

    setIsSaving(true);
    setSaveResultMessage(null);

    try {
      const result = await saveApprovedOrdersToFirestore(ordersToSave, currentUser);

      // Mark locally as saved
      const savedIdsSet = new Set(result.savedIds);
      setOrders((prev) =>
        prev.map((ord) => {
          if (savedIdsSet.has(ord.id)) {
            return {
              ...ord,
              savedToFirestore: true,
              savedAt: new Date().toLocaleTimeString(),
              saveError: undefined,
            };
          }
          return ord;
        })
      );

      const msg =
        result.duplicateCount > 0
          ? `¡Éxito! Se registraron ${result.savedCount} orden(es) en Cloud Firestore (${result.duplicateCount} omitidas por idempotencia/duplicadas).`
          : `¡Éxito! Se registraron ${result.savedCount} orden(es) en Cloud Firestore con todas sus validaciones.`;

      setSaveResultMessage({ type: 'success', text: msg });
      setShowConfirmModal(false);
      onSaveSuccess(result.savedCount);
    } catch (error: any) {
      console.error('Error saving to Firestore:', error);
      setSaveResultMessage({
        type: 'error',
        text: error.message || 'Error al guardar en Cloud Firestore. Revisa las reglas de seguridad o tu conexión.',
      });
      setShowConfirmModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredOrders = orders.filter((ord) => {
    if (statusFilter === 'pending' && (ord.approved || ord.savedToFirestore)) return false;
    if (statusFilter === 'approved' && (!ord.approved || ord.savedToFirestore)) return false;
    if (statusFilter === 'saved' && !ord.savedToFirestore) return false;
    if (statusFilter === 'warning' && (!ord.warnings || ord.warnings.length === 0)) return false;

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (ord.ot && ord.ot.toLowerCase().includes(term)) ||
      (ord.ordenPhoenix && ord.ordenPhoenix.toLowerCase().includes(term)) ||
      (ord.tecnico && ord.tecnico.toLowerCase().includes(term)) ||
      (ord.nombres && ord.nombres.toLowerCase().includes(term)) ||
      (ord.codigo && ord.codigo.toLowerCase().includes(term)) ||
      (ord.nodo && ord.nodo.toLowerCase().includes(term)) ||
      (ord.tipo && ord.tipo.toLowerCase().includes(term))
    );
  });

  const totalCount = orders.length;
  const pendingCount = orders.filter((o) => !o.approved && !o.savedToFirestore).length;
  const approvedReadyCount = orders.filter((o) => o.approved && !o.savedToFirestore).length;
  const savedCount = orders.filter((o) => o.savedToFirestore).length;
  const warningCount = orders.filter((o) => o.warnings && o.warnings.length > 0).length;

  const handleCopyTsv = async () => {
    const success = await copyOrdersToTsv(filteredOrders);
    if (success) {
      setCopiedTsv(true);
      setTimeout(() => setCopiedTsv(false), 2500);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Toast / Notification Banner */}
      {saveResultMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 text-xs sm:text-sm ${
            saveResultMessage.type === 'success'
              ? 'bg-[#E6F7F1] border-[#B6EAD7] text-[#16A878]'
              : 'bg-[#FDECEC] border-[#F8BDBD] text-[#DC4545]'
          }`}
        >
          <div className="flex items-center space-x-2">
            {saveResultMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span className="font-medium">{saveResultMessage.text}</span>
          </div>
          <button
            onClick={() => setSaveResultMessage(null)}
            className="text-xs px-2 py-0.5 rounded font-semibold"
          >
            OK
          </button>
        </div>
      )}

      {/* Top Filter Chips Bar */}
      <div className="bg-white border border-[#E3E8F0] rounded-2xl p-3 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-bold text-[#202A3C]">Órdenes ({totalCount})</span>
            {approvedReadyCount > 0 && (
              <span className="px-1.5 py-0.2 bg-[#E6F7F1] text-[#16A878] rounded-full text-[10px] font-bold">
                {approvedReadyCount} listas
              </span>
            )}
          </div>

          {/* Quick Export options */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => exportOrdersToExcel(filteredOrders)}
              disabled={filteredOrders.length === 0}
              className="px-2 py-1 bg-[#F5F7FA] hover:bg-[#EBF2FE] text-[#202A3C] text-[11px] font-bold rounded-lg border border-[#E3E8F0] flex items-center space-x-1 disabled:opacity-40"
              title="Descargar como Excel (.xlsx)"
            >
              <Download className="w-3 h-3 text-[#16A878]" />
              <span>XLSX</span>
            </button>
            <button
              onClick={() => exportOrdersToCsv(filteredOrders)}
              disabled={filteredOrders.length === 0}
              className="px-2 py-1 bg-[#F5F7FA] hover:bg-[#EBF2FE] text-[#202A3C] text-[11px] font-bold rounded-lg border border-[#E3E8F0] flex items-center space-x-1 disabled:opacity-40"
              title="Descargar como CSV UTF-8"
            >
              <Download className="w-3 h-3 text-[#3478F6]" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${
              statusFilter === 'all'
                ? 'bg-[#3478F6] text-white shadow-2xs'
                : 'bg-[#F5F7FA] text-[#718096] hover:text-[#202A3C]'
            }`}
          >
            Todas ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${
              statusFilter === 'pending'
                ? 'bg-[#D97706] text-white shadow-2xs'
                : 'bg-[#F5F7FA] text-[#718096] hover:text-[#D97706]'
            }`}
          >
            Por revisar ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${
              statusFilter === 'approved'
                ? 'bg-[#16A878] text-white shadow-2xs'
                : 'bg-[#F5F7FA] text-[#718096] hover:text-[#16A878]'
            }`}
          >
            Aprobadas ({approvedReadyCount})
          </button>
          <button
            onClick={() => setStatusFilter('saved')}
            className={`px-3 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${
              statusFilter === 'saved'
                ? 'bg-[#202A3C] text-white shadow-2xs'
                : 'bg-[#F5F7FA] text-[#718096] hover:text-[#202A3C]'
            }`}
          >
            Guardadas ({savedCount})
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#718096] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por OT, Phoenix, Técnico o Cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#F5F7FA] border border-[#E3E8F0] rounded-xl text-xs text-[#202A3C] placeholder-[#A0AEC0] focus:outline-none focus:border-[#3478F6] focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Batch toolbar if items selected */}
      {selectedOrderIds.size > 0 && (
        <div className="bg-[#EBF2FE] border border-[#D0E2FF] rounded-xl p-2.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-[#3478F6]">
            {selectedOrderIds.size} seleccionadas
          </span>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => handleBatchApprove(true)}
              className="px-2.5 py-1 bg-[#16A878] text-white rounded-lg font-medium"
            >
              Aprobar
            </button>
            <button
              onClick={() => handleBatchApprove(false)}
              className="px-2.5 py-1 bg-white text-[#8A6100] border border-[#FFE7A3] rounded-lg font-medium"
            >
              Desaprobar
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredOrders.length === 0 && (
        <div className="bg-white border border-[#E3E8F0] rounded-2xl p-8 text-center shadow-xs">
          <div className="w-10 h-10 mx-auto rounded-full bg-[#F5F7FA] flex items-center justify-center text-[#718096] mb-2">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-[#202A3C]">No hay órdenes que coincidan</h3>
          <p className="text-xs text-[#718096] mt-0.5">
            {orders.length === 0
              ? 'Toma una foto en la pestaña "Cargar" para extraer órdenes.'
              : 'Prueba cambiando los filtros o la búsqueda.'}
          </p>
        </div>
      )}

      {/* MOBILE-FIRST: ORDER CARDS VIEW */}
      <div className="space-y-3">
        {filteredOrders.map((ord) => {
          const isSelected = selectedOrderIds.has(ord.id);
          const isExpanded = expandedCards.has(ord.id);

          return (
            <div
              key={ord.id}
              className={`bg-white border rounded-2xl overflow-hidden shadow-xs transition-all ${
                ord.savedToFirestore
                  ? 'border-[#B6EAD7] bg-[#FAFDFB]'
                  : ord.approved
                  ? 'border-[#B2D1FD] bg-[#FBFCFE]'
                  : 'border-[#E3E8F0]'
              }`}
            >
              {/* Order Card Header */}
              <div className="p-3.5 space-y-2.5 border-b border-[#E3E8F0]">
                <div className="flex items-center justify-between gap-2">
                  {/* Checkbox & OT / Phoenix */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleSelect(ord.id)}
                      className="text-[#718096] hover:text-[#202A3C]"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#3478F6]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#CBD5E1]" />
                      )}
                    </button>

                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 bg-[#EBF2FE] text-[#3478F6] rounded-md border border-[#D0E2FF]">
                        {ord.ot || 'SIN OT'}
                      </span>

                      {ord.ordenPhoenix ? (
                        <span className="font-mono text-[11px] px-1.5 py-0.5 bg-[#F5F3FF] text-[#5856D6] rounded border border-[#DDD6FE]">
                          PHX: {ord.ordenPhoenix}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Thumbnail Inspect Button */}
                  {ord.imageDataUrl && (
                    <button
                      onClick={() =>
                        onOpenImageModal(ord.imageDataUrl!, ord.imageName, {
                          ot: ord.ot,
                          ordenPhoenix: ord.ordenPhoenix,
                          tecnico: ord.tecnico,
                          nombres: ord.nombres,
                          warnings: ord.warnings,
                        })
                      }
                      className="w-8 h-8 rounded-lg overflow-hidden border border-[#E3E8F0] shrink-0 active:scale-95 transition-transform"
                      title="Ver fotografía original"
                    >
                      <img
                        src={ord.imageDataUrl}
                        alt={ord.imageName}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )}
                </div>

                {/* Customer & Technician summary */}
                <div>
                  <h4 className="font-bold text-sm text-[#202A3C] leading-snug">
                    {ord.nombres || 'Cliente no identificado'}
                  </h4>
                  <p className="text-xs text-[#718096] mt-0.5">
                    {ord.tecnico || 'Técnico no identificado'} • {ord.tipo || 'Sin tipo'}
                  </p>
                </div>

                {/* Big Thumb Approval Button */}
                <div className="pt-1 flex items-center justify-between gap-2">
                  {ord.savedToFirestore ? (
                    <div className="w-full py-2 px-3 rounded-xl bg-[#E6F7F1] text-[#16A878] border border-[#B6EAD7] flex items-center justify-center space-x-1.5 text-xs font-bold">
                      <Database className="w-4 h-4" />
                      <span>Guardada en Cloud Firestore</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleApproval(ord.id)}
                      className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all active:scale-[0.98] ${
                        ord.approved
                          ? 'bg-[#16A878] text-white shadow-xs'
                          : 'bg-[#FFF4D6] text-[#8A6100] border border-[#FFE7A3]'
                      }`}
                    >
                      {ord.approved ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-white" />
                          <span>Aprobada para guardar</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-[#8A6100]" />
                          <span>Toca para Aprobar</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => toggleCardExpanded(ord.id)}
                    className="p-2 text-[#718096] hover:text-[#202A3C] bg-[#F5F7FA] rounded-xl border border-[#E3E8F0]"
                    title="Expandir 10 campos para editar"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expandable Form Fields for Detailed Verification & Editing */}
              {isExpanded && (
                <div className="p-3.5 bg-[#F8FAFD] space-y-3 text-xs border-t border-[#E3E8F0]">
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* 1. FECHA */}
                    <div>
                      <label className="block text-[10px] font-bold text-[#718096] uppercase mb-0.5">
                        1. Fecha
                      </label>
                      <input
                        type="text"
                        value={ord.fecha}
                        onChange={(e) => handleFieldChange(ord.id, 'fecha', e.target.value)}
                        placeholder="DD/MM/AAAA"
                        disabled={ord.savedToFirestore}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#E3E8F0] rounded-lg text-xs text-[#202A3C] focus:outline-none focus:border-[#3478F6]"
                      />
                    </div>

                    {/* 4. CODIGO */}
                    <div>
                      <label className="block text-[10px] font-bold text-[#718096] uppercase mb-0.5">
                        4. Código Cliente
                      </label>
                      <input
                        type="text"
                        value={ord.codigo}
                        onChange={(e) => handleFieldChange(ord.id, 'codigo', e.target.value)}
                        placeholder="CLI-..."
                        disabled={ord.savedToFirestore}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#E3E8F0] rounded-lg text-xs font-mono text-[#202A3C] focus:outline-none focus:border-[#3478F6]"
                      />
                    </div>
                  </div>

                  {/* 2. TECNICO */}
                  <div>
                    <label className="block text-[10px] font-bold text-[#718096] uppercase mb-0.5">
                      2. Técnico
                    </label>
                    <input
                      type="text"
                      value={ord.tecnico}
                      onChange={(e) => handleFieldChange(ord.id, 'tecnico', e.target.value)}
                      placeholder="Nombre del técnico"
                      disabled={ord.savedToFirestore}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E3E8F0] rounded-lg text-xs text-[#202A3C] focus:outline-none focus:border-[#3478F6]"
                    />
                  </div>

                  {/* 3. TIPO */}
                  <div>
                    <label className="block text-[10px] font-bold text-[#718096] uppercase mb-0.5">
                      3. Tipo de Solicitud
                    </label>
                    <input
                      type="text"
                      value={ord.tipo}
                      onChange={(e) => handleFieldChange(ord.id, 'tipo', e.target.value)}
                      placeholder="Instalación, Reparación, etc."
                      disabled={ord.savedToFirestore}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E3E8F0] rounded-lg text-xs text-[#202A3C] focus:outline-none focus:border-[#3478F6]"
                    />
                  </div>

                  {/* 5. OT & 7. PHOENIX (Strictly distinct) */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-[#3478F6] uppercase mb-0.5">
                        5. N° OT *
                      </label>
                      <input
                        type="text"
                        value={ord.ot}
                        onChange={(e) => handleFieldChange(ord.id, 'ot', e.target.value)}
                        placeholder="OT-..."
                        disabled={ord.savedToFirestore}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#D0E2FF] rounded-lg text-xs font-mono font-bold text-[#3478F6] focus:outline-none focus:border-[#3478F6]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#5856D6] uppercase mb-0.5">
                        7. N° Phoenix *
                      </label>
                      <input
                        type="text"
                        value={ord.ordenPhoenix}
                        onChange={(e) => handleFieldChange(ord.id, 'ordenPhoenix', e.target.value)}
                        placeholder="PHX-..."
                        disabled={ord.savedToFirestore}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#DDD6FE] rounded-lg text-xs font-mono font-semibold text-[#5856D6] focus:outline-none focus:border-[#5856D6]"
                      />
                    </div>
                  </div>

                  {/* 6. NOMBRES */}
                  <div>
                    <label className="block text-[10px] font-bold text-[#718096] uppercase mb-0.5">
                      6. Nombres del Cliente
                    </label>
                    <input
                      type="text"
                      value={ord.nombres}
                      onChange={(e) => handleFieldChange(ord.id, 'nombres', e.target.value)}
                      placeholder="Nombres y apellidos"
                      disabled={ord.savedToFirestore}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E3E8F0] rounded-lg text-xs text-[#202A3C] focus:outline-none focus:border-[#3478F6]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* 8. NODO */}
                    <div>
                      <label className="block text-[10px] font-bold text-[#718096] uppercase mb-0.5">
                        8. Nodo
                      </label>
                      <input
                        type="text"
                        value={ord.nodo}
                        onChange={(e) => handleFieldChange(ord.id, 'nodo', e.target.value)}
                        placeholder="NODO-..."
                        disabled={ord.savedToFirestore}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#E3E8F0] rounded-lg text-xs font-mono text-[#202A3C] focus:outline-none focus:border-[#3478F6]"
                      />
                    </div>

                    {/* 9. ESTADO */}
                    <div>
                      <label className="block text-[10px] font-bold text-[#718096] uppercase mb-0.5">
                        9. Estado
                      </label>
                      <input
                        type="text"
                        value={ord.estado}
                        onChange={(e) => handleFieldChange(ord.id, 'estado', e.target.value)}
                        placeholder="Ejecutada / Pendiente"
                        disabled={ord.savedToFirestore}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#E3E8F0] rounded-lg text-xs text-[#202A3C] focus:outline-none focus:border-[#3478F6]"
                      />
                    </div>
                  </div>

                  {/* 10. OBSERVACION (Strictly empty) */}
                  <div>
                    <label className="block text-[10px] font-bold text-[#A0AEC0] uppercase mb-0.5">
                      10. Observación (Siempre vacía por normativa)
                    </label>
                    <input
                      type="text"
                      value=""
                      disabled
                      placeholder="(Siempre vacía)"
                      className="w-full px-2.5 py-1.5 bg-[#F5F7FA] border border-dashed border-[#CBD5E1] rounded-lg text-xs italic text-[#A0AEC0] cursor-not-allowed text-center"
                    />
                  </div>

                  {/* Card delete button */}
                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => handleDeleteOrder(ord.id)}
                      disabled={ord.savedToFirestore}
                      className="px-2.5 py-1 text-xs text-[#DC4545] hover:bg-[#FDECEC] rounded-lg flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar orden</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Persistent Floating Bottom Action Bar */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-4 py-2 pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={approvedReadyCount === 0 || isSaving}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 shadow-lg transition-transform active:scale-[0.98] ${
              approvedReadyCount > 0
                ? 'bg-[#3478F6] text-white'
                : 'bg-[#CBD5E1] text-[#718096] cursor-not-allowed opacity-80'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando en Firestore...</span>
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                <span>Guardar Aprobadas ({approvedReadyCount}) en Firestore</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-[#202A3C]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E8F0] rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#EBF2FE] text-[#3478F6] flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#202A3C]">Guardar en Cloud Firestore</h3>
                <p className="text-xs text-[#718096]">{approvedReadyCount} órdenes aprobadas listas</p>
              </div>
            </div>

            <p className="text-xs text-[#718096] leading-relaxed">
              Las órdenes aprobadas se registrarán de forma permanente en la base de datos Firestore.
              La columna <strong>OBSERVACION se mantendrá vacía</strong> según la normativa estricta.
            </p>

            {!currentUser && (
              <div className="p-2.5 bg-[#FFF4D6] border border-[#FFE7A3] rounded-xl text-xs text-[#8A6100]">
                ⚠️ Requiere que inicies sesión con Google para autenticar la operación en Firestore.
              </div>
            )}

            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E3E8F0] text-xs font-semibold text-[#718096]"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveToFirestore}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl bg-[#3478F6] text-white text-xs font-bold shadow-xs"
              >
                {isSaving ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
