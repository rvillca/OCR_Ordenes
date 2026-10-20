import React, { useState } from 'react';
import {
  Database,
  Clock,
  Download,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  Search,
  Trash2,
  User as UserIcon,
  Filter,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { TechnicalOrder } from '../types/order.js';
import { FirestoreOrderRecord, deleteFirestoreOrder } from '../services/firebase.js';
import { exportOrdersToCsv, exportOrdersToExcel, copyOrdersToTsv } from '../utils/exportOrders.js';
import { User } from 'firebase/auth';

interface HistoryTabProps {
  firestoreOrders: FirestoreOrderRecord[];
  currentUser: User | null;
  userRole: 'admin' | 'operador';
  sheetsConfig: {
    spreadsheetId: string;
    sheetName: string;
    serviceAccountConfigured: boolean;
    serviceAccountEmail?: string | null;
  };
  onRefreshOrders?: () => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  firestoreOrders,
  currentUser,
  userRole,
  sheetsConfig,
  onRefreshOrders,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedTsv, setCopiedTsv] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<string>('all');
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);

  // Extract unique technicians for fast filtering
  const uniqueTechnicians = Array.from(
    new Set(firestoreOrders.map((o) => o.tecnico).filter(Boolean))
  ).sort();

  const filtered = firestoreOrders.filter((ord) => {
    if (selectedTechnician !== 'all' && ord.tecnico !== selectedTechnician) {
      return false;
    }

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (ord.ot && ord.ot.toLowerCase().includes(term)) ||
      (ord.ordenPhoenix && ord.ordenPhoenix.toLowerCase().includes(term)) ||
      (ord.tecnico && ord.tecnico.toLowerCase().includes(term)) ||
      (ord.nombres && ord.nombres.toLowerCase().includes(term)) ||
      (ord.nodo && ord.nodo.toLowerCase().includes(term)) ||
      (ord.codigo && ord.codigo.toLowerCase().includes(term)) ||
      (ord.createdByEmail && ord.createdByEmail.toLowerCase().includes(term))
    );
  });

  const handleCopyTsv = async () => {
    const success = await copyOrdersToTsv(filtered);
    if (success) {
      setCopiedTsv(true);
      setTimeout(() => setCopiedTsv(false), 2500);
    }
  };

  const handleSyncToSheets = async () => {
    if (filtered.length === 0) {
      alert('No hay órdenes registradas para sincronizar.');
      return;
    }

    // Check what is missing and show precise message (Requirement 7)
    if (!sheetsConfig.spreadsheetId || !sheetsConfig.spreadsheetId.trim()) {
      setStatusMessage('Google Sheets no configurado: Falta el ID o enlace de la hoja de cálculo en la sección de Configuración.');
      return;
    }

    if (!sheetsConfig.serviceAccountConfigured) {
      setStatusMessage('Google Sheets no configurado: Falta la Cuenta de Servicio de Google Cloud (archivo JSON) en la sección de Configuración.');
      return;
    }

    setIsSyncingSheets(true);
    setStatusMessage(null);
    try {
      // Map to the 10 strictly ordered records
      const recordsToSync = filtered.map((o) => ({
        id: o.id,
        fecha: o.fecha || '',
        tecnico: o.tecnico || '',
        tipo: o.tipo || '',
        codigo: o.codigo || '',
        ot: o.ot || '',
        nombres: o.nombres || '',
        ordenPhoenix: o.ordenPhoenix || '',
        nodo: o.nodo || '',
        estado: o.estado || '',
        observacion: '',
        approved: true,
      }));

      const res = await fetch('/api/sheets/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: recordsToSync }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al sincronizar con Google Sheets');
      }

      setStatusMessage(`¡Sincronización opcional exitosa! Se guardaron ${data.savedCount} orden(es) en Google Sheets.`);
    } catch (err: any) {
      setStatusMessage(`Error en sincronización opcional: ${err.message}`);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleDelete = async (orderId: string, otText: string) => {
    if (userRole !== 'admin') {
      alert('Solo los administradores tienen permiso para eliminar registros en Cloud Firestore.');
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar permanentemente la orden ${otText || orderId} de Cloud Firestore?`)) {
      return;
    }

    setDeletingId(orderId);
    try {
      await deleteFirestoreOrder(orderId);
      setStatusMessage(`Orden ${otText} eliminada correctamente.`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const sheetsUrl = sheetsConfig.spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${sheetsConfig.spreadsheetId}/edit`
    : null;

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {statusMessage && (
        <div className="p-3 bg-[#E6F7F1] border border-[#B6EAD7] rounded-xl text-xs font-semibold text-[#16A878] flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-[11px] underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Overview Card */}
      <div className="bg-white border border-[#E3E8F0] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[#16A878]">
            <Database className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {userRole === 'admin' ? 'Órdenes Globales (Admin)' : 'Mis Órdenes en Firestore'}
            </span>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#E6F7F1] text-[#16A878] border border-[#B6EAD7]">
            {firestoreOrders.length} registradas
          </span>
        </div>

        <p className="text-xs text-[#718096] leading-relaxed">
          {userRole === 'admin'
            ? 'Vista administrativa con acceso global a todas las órdenes registradas por el equipo en Cloud Firestore.'
            : 'Historial personal de órdenes aprobadas y almacenadas de forma persistente en Cloud Firestore.'}
        </p>

        {/* Export Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            onClick={() => exportOrdersToExcel(filtered, 'ordenes_tecnicas_firestore.xlsx')}
            disabled={filtered.length === 0}
            className="py-2.5 px-2 bg-[#16A878] hover:bg-[#128C63] text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-2xs transition-colors disabled:opacity-40"
            title="Exportar a Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => exportOrdersToCsv(filtered, 'ordenes_tecnicas_firestore.csv')}
            disabled={filtered.length === 0}
            className="py-2.5 px-2 bg-[#3478F6] hover:bg-[#2563EB] text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-2xs transition-colors disabled:opacity-40"
            title="Exportar a CSV UTF-8"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleCopyTsv}
            disabled={filtered.length === 0}
            className="py-2.5 px-2 bg-[#F5F7FA] text-[#202A3C] border border-[#E3E8F0] rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-40"
            title="Copiar datos al portapapeles"
          >
            {copiedTsv ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#16A878] shrink-0" />
                <span className="text-[#16A878]">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#718096] shrink-0" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>

        {/* Optional Google Sheets Sync Action */}
        <div className="pt-2 border-t border-[#E3E8F0]">
          <button
            onClick={handleSyncToSheets}
            disabled={isSyncingSheets || filtered.length === 0}
            className="w-full py-2.5 px-3 bg-[#F8FAFD] hover:bg-[#EBF2FE] text-[#202A3C] border border-[#E3E8F0] rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
            title="Sincronización opcional de respaldo en Google Sheets"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#3478F6]" />
            <span>
              {isSyncingSheets ? 'Sincronizando con Google Sheets...' : 'Sincronizar con Google Sheets (Opcional)'}
            </span>
          </button>
        </div>

        {sheetsUrl && (
          <div className="pt-1">
            <a
              href={sheetsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2 px-3 bg-white text-[#3478F6] border border-[#D0E2FF] rounded-xl text-xs font-medium flex items-center justify-center space-x-1.5 hover:bg-[#F8FAFD]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir Hoja en Google Sheets</span>
            </a>
          </div>
        )}
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white border border-[#E3E8F0] rounded-2xl p-3 shadow-xs space-y-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#718096] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por OT, Phoenix, Técnico, Cliente o Nodo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-[#F5F7FA] border border-[#E3E8F0] rounded-xl text-xs text-[#202A3C] placeholder-[#A0AEC0] focus:outline-none focus:border-[#3478F6] focus:bg-white transition-all"
          />
        </div>

        {uniqueTechnicians.length > 1 && (
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[10px] uppercase font-bold text-[#718096] shrink-0">Técnico:</span>
            <button
              onClick={() => setSelectedTechnician('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
                selectedTechnician === 'all'
                  ? 'bg-[#3478F6] text-white'
                  : 'bg-[#F5F7FA] text-[#718096] hover:text-[#202A3C]'
              }`}
            >
              Todos
            </button>
            {uniqueTechnicians.map((tec) => (
              <button
                key={tec}
                onClick={() => setSelectedTechnician(tec)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
                  selectedTechnician === tec
                    ? 'bg-[#3478F6] text-white'
                    : 'bg-[#F5F7FA] text-[#718096] hover:text-[#202A3C]'
                }`}
              >
                {tec}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="bg-white border border-[#E3E8F0] rounded-2xl p-8 text-center shadow-xs">
          <div className="w-10 h-10 mx-auto rounded-full bg-[#F5F7FA] flex items-center justify-center text-[#718096] mb-2">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-[#202A3C]">
            {firestoreOrders.length === 0 ? 'Sin órdenes en Firestore todavía' : 'Sin coincidencias'}
          </h3>
          <p className="text-xs text-[#718096] mt-0.5 max-w-xs mx-auto">
            {firestoreOrders.length === 0
              ? 'Las órdenes que apruebes en "Revisión" y envíes a Cloud Firestore se mostrarán aquí.'
              : 'Prueba ajustando el texto de búsqueda o el filtro de técnico.'}
          </p>
        </div>
      )}

      {/* Card List of Registered Orders */}
      <div className="space-y-3">
        {filtered.map((ord) => {
          const dateStr = ord.createdAt
            ? new Date(ord.createdAt).toLocaleDateString() + ' ' + new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : ord.fecha || 'Sin fecha';

          return (
            <div
              key={ord.id}
              className="bg-white border border-[#E3E8F0] rounded-2xl p-3.5 shadow-xs space-y-2.5 hover:border-[#CBD5E1] transition-colors"
            >
              {/* Header: OT, Phoenix & Date */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                  <span className="font-mono font-bold text-xs px-2 py-0.5 bg-[#EBF2FE] text-[#3478F6] rounded-md border border-[#D0E2FF]">
                    {ord.ot || 'SIN OT'}
                  </span>
                  {ord.ordenPhoenix && (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#F5F3FF] text-[#5856D6] rounded border border-[#DDD6FE]">
                      PHX: {ord.ordenPhoenix}
                    </span>
                  )}
                  {ord.codigo && (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#F5F7FA] text-[#718096] rounded border border-[#E3E8F0]">
                      {ord.codigo}
                    </span>
                  )}
                </div>

                <span className="text-[10px] font-mono text-[#718096] shrink-0">
                  {dateStr}
                </span>
              </div>

              {/* Client & Technical Details */}
              <div>
                <h4 className="font-bold text-xs text-[#202A3C] leading-snug">
                  {ord.nombres || 'Cliente sin nombre'}
                </h4>
                <div className="flex items-center space-x-2 text-[11px] text-[#718096] mt-0.5 flex-wrap">
                  <span className="font-medium text-[#202A3C]">{ord.tecnico || 'Técnico s/d'}</span>
                  <span>•</span>
                  <span>{ord.tipo || 'Sin tipo'}</span>
                  <span>•</span>
                  <span>Nodo: {ord.nodo || '-'}</span>
                  <span>•</span>
                  <span className="font-medium text-[#16A878]">{ord.estado || 'OK'}</span>
                </div>
              </div>

              {/* Creator details & Admin actions */}
              <div className="pt-2 border-t border-[#E3E8F0] flex items-center justify-between text-[10px] text-[#718096]">
                <div className="flex items-center space-x-1 truncate max-w-[200px] sm:max-w-none">
                  <UserIcon className="w-3 h-3 text-[#718096] shrink-0" />
                  <span className="truncate">{ord.createdByEmail || 'operador'}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[#16A878] font-bold flex items-center space-x-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Firestore</span>
                  </span>

                  {userRole === 'admin' && (
                    <button
                      onClick={() => handleDelete(ord.id, ord.ot)}
                      disabled={deletingId === ord.id}
                      className="p-1 text-[#DC4545] hover:bg-[#FDECEC] rounded transition-colors"
                      title="Eliminar orden (Admin)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
