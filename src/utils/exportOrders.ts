import * as XLSX from 'xlsx';
import { REQUIRED_COLUMNS } from '../types/order.js';

export interface ExportableOrder {
  fecha: string;
  tecnico: string;
  tipo: string;
  codigo: string;
  ot: string;
  nombres: string;
  ordenPhoenix: string;
  nodo: string;
  estado: string;
  observacion: string;
}

// Security: Prevent CSV / Excel formula injection (DDE attacks)
function sanitizeCellForSpreadsheet(val: any): string {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  // If string starts with =, +, -, @, prefix with a quote so Excel treats it as plain text
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function exportOrdersToExcel(
  orders: ExportableOrder[],
  filename = 'ordenes_tecnicas.xlsx'
) {
  if (!orders || orders.length === 0) {
    alert('No hay órdenes seleccionadas para exportar.');
    return;
  }

  // Map rows strictly to the 10 defined columns
  const dataRows = orders.map((o) => ({
    'FECHA': sanitizeCellForSpreadsheet(o.fecha),
    'TECNICO': sanitizeCellForSpreadsheet(o.tecnico),
    'TIPO': sanitizeCellForSpreadsheet(o.tipo),
    'CODIGO': sanitizeCellForSpreadsheet(o.codigo),
    'OT': sanitizeCellForSpreadsheet(o.ot),
    'NOMBRES': sanitizeCellForSpreadsheet(o.nombres),
    'N° ORDEN PHOENIX': sanitizeCellForSpreadsheet(o.ordenPhoenix),
    'NODO': sanitizeCellForSpreadsheet(o.nodo),
    'ESTADO': sanitizeCellForSpreadsheet(o.estado),
    'OBSERVACION': '', // STRICTLY EMPTY PER SPECIFICATION
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataRows, {
    header: [...REQUIRED_COLUMNS],
  });

  // Set explicit column widths for clean readability
  worksheet['!cols'] = [
    { wch: 14 }, // FECHA
    { wch: 25 }, // TECNICO
    { wch: 22 }, // TIPO
    { wch: 15 }, // CODIGO
    { wch: 16 }, // OT
    { wch: 28 }, // NOMBRES
    { wch: 18 }, // N° ORDEN PHOENIX
    { wch: 16 }, // NODO
    { wch: 16 }, // ESTADO
    { wch: 16 }, // OBSERVACION
  ];

  // Enable autofilter on all 10 columns
  if (orders.length > 0) {
    worksheet['!autofilter'] = {
      ref: `A1:J${orders.length + 1}`,
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Órdenes Técnicas');

  // Trigger browser download
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function exportOrdersToCsv(
  orders: ExportableOrder[],
  filename = 'ordenes_tecnicas.csv'
) {
  if (!orders || orders.length === 0) {
    alert('No hay órdenes seleccionadas para exportar.');
    return;
  }

  const escapeCsv = (val: string) => {
    const sanitized = sanitizeCellForSpreadsheet(val);
    const escaped = sanitized.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const headerLine = REQUIRED_COLUMNS.map(escapeCsv).join(',');
  const rowLines = orders.map((o) =>
    [
      escapeCsv(o.fecha),
      escapeCsv(o.tecnico),
      escapeCsv(o.tipo),
      escapeCsv(o.codigo),
      escapeCsv(o.ot),
      escapeCsv(o.nombres),
      escapeCsv(o.ordenPhoenix),
      escapeCsv(o.nodo),
      escapeCsv(o.estado),
      '""', // OBSERVACION ALWAYS EMPTY
    ].join(',')
  );

  // Prepend UTF-8 BOM so Excel opens Spanish accents & ° seamlessly
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function copyOrdersToTsv(orders: ExportableOrder[]): Promise<boolean> {
  if (!orders || orders.length === 0) return false;

  const headerLine = REQUIRED_COLUMNS.join('\t');
  const rowLines = orders.map((o) =>
    [
      sanitizeCellForSpreadsheet(o.fecha),
      sanitizeCellForSpreadsheet(o.tecnico),
      sanitizeCellForSpreadsheet(o.tipo),
      sanitizeCellForSpreadsheet(o.codigo),
      sanitizeCellForSpreadsheet(o.ot),
      sanitizeCellForSpreadsheet(o.nombres),
      sanitizeCellForSpreadsheet(o.ordenPhoenix),
      sanitizeCellForSpreadsheet(o.nodo),
      sanitizeCellForSpreadsheet(o.estado),
      '', // OBSERVACION always empty
    ].join('\t')
  );

  const tsv = [headerLine, ...rowLines].join('\n');
  try {
    await navigator.clipboard.writeText(tsv);
    return true;
  } catch (err) {
    console.error('Failed to copy TSV to clipboard:', err);
    return false;
  }
}
