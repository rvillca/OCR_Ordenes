export interface TechnicalOrder {
  id: string; // Unique ID for frontend tracking
  imageId: string; // ID of the photograph it originated from
  imageName: string;
  imageDataUrl?: string; // Preview image
  detectedAt: string;
  approved: boolean; // User MUST explicitly approve
  savedToSheets: boolean;
  savedToFirestore?: boolean;
  firestoreId?: string;
  createdByEmail?: string;
  savedAt?: string;
  saveError?: string;

  // The 10 strict columns
  fecha: string;
  tecnico: string;
  tipo: string;
  codigo: string;
  ot: string;
  nombres: string;
  ordenPhoenix: string;
  nodo: string;
  estado: string;
  observacion: string; // ALWAYS EMPTY

  // OCR metadata (not written to sheets, used for review UI)
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  fieldStatus: {
    fecha: 'valid' | 'empty' | 'uncertain';
    tecnico: 'valid' | 'empty' | 'uncertain';
    tipo: 'valid' | 'empty' | 'uncertain';
    codigo: 'valid' | 'empty' | 'uncertain';
    ot: 'valid' | 'empty' | 'uncertain';
    nombres: 'valid' | 'empty' | 'uncertain';
    ordenPhoenix: 'valid' | 'empty' | 'uncertain';
    nodo: 'valid' | 'empty' | 'uncertain';
    estado: 'valid' | 'empty' | 'uncertain';
  };
  hasMultipleOrdersInImage?: boolean;
}

export interface ImageUploadItem {
  id: string;
  file?: File;
  name: string;
  size: number;
  mimeType: string;
  dataUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
  warningMessage?: string;
  isBlurry?: boolean;
  ordersFoundCount: number;
  processedAt?: string;
}

export interface SheetsConfig {
  spreadsheetId: string;
  sheetName: string;
  serviceAccountConfigured: boolean;
  oauthConfigured: boolean;
  lastVerifiedAt?: string;
  headersMatch?: boolean;
  isVerified?: boolean;
}

export interface SheetsVerifyResponse {
  connected: boolean;
  sheetTitle?: string;
  headersMatch?: boolean;
  existingHeaders?: string[];
  missingHeaders?: string[];
  rowCount?: number;
  message: string;
  canWrite?: boolean;
}

export interface AppendResult {
  success: boolean;
  savedCount: number;
  failedCount: number;
  insertedIds: string[];
  alreadySavedIds: string[];
  message: string;
  timestamp: string;
}

export const REQUIRED_COLUMNS = [
  'FECHA',
  'TECNICO',
  'TIPO',
  'CODIGO',
  'OT',
  'NOMBRES',
  'N° ORDEN PHOENIX',
  'NODO',
  'ESTADO',
  'OBSERVACION',
] as const;
