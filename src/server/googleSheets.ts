import { JWT } from 'google-auth-library';
import { REQUIRED_COLUMNS } from '../types/order.js';

export interface SheetRowRecord {
  id?: string;
  fecha: string;
  tecnico: string;
  tipo: string;
  codigo: string;
  ot: string;
  nombres: string;
  ordenPhoenix: string;
  nodo: string;
  estado: string;
  observacion: string; // Strictly empty string
}

// In-memory idempotency cache for duplicate prevention during retries and session duration
const savedOrdersFingerprints = new Set<string>();

export function generateFingerprint(record: SheetRowRecord): string {
  // Unique fingerprint based on OT, Phoenix, Codigo, Fecha and Nombres
  // Do NOT consider two orders equal solely by technician or date!
  const otKey = (record.ot || '').trim().toUpperCase();
  const phoenixKey = (record.ordenPhoenix || '').trim().toUpperCase();
  const codigoKey = (record.codigo || '').trim().toUpperCase();
  const fechaKey = (record.fecha || '').trim();
  const nombreKey = (record.nombres || '').trim().toUpperCase();

  // If both OT and Phoenix exist, use both
  return `${otKey}:::${phoenixKey}:::${codigoKey}:::${nombreKey}:::${fechaKey}`;
}

// In-memory active configuration
let activeServiceAccountJson: any = null;
let activeSpreadsheetId: string = process.env.GOOGLE_SPREADSHEET_ID || '';
let activeSheetName: string = process.env.GOOGLE_SHEET_NAME || 'Hoja 1';

// Try loading service account from environment variable if present
if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    activeServiceAccountJson = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  } catch (err) {
    console.warn('Could not parse GOOGLE_SERVICE_ACCOUNT_KEY from env:', err);
  }
}

export function setGoogleSheetsConfig(config: {
  spreadsheetId?: string;
  sheetName?: string;
  serviceAccountJson?: any;
}) {
  if (config.spreadsheetId !== undefined) {
    activeSpreadsheetId = extractSpreadsheetId(config.spreadsheetId);
  }
  if (config.sheetName !== undefined) {
    activeSheetName = config.sheetName || 'Hoja 1';
  }
  if (config.serviceAccountJson !== undefined) {
    activeServiceAccountJson = config.serviceAccountJson;
  }
}

export function getGoogleSheetsConfig() {
  const hasSpreadsheet = Boolean(activeSpreadsheetId && activeSpreadsheetId.trim().length > 0);
  const hasServiceAccount = Boolean(activeServiceAccountJson && activeServiceAccountJson.client_email);
  const isConfigured = hasSpreadsheet && hasServiceAccount;

  return {
    isConfigured,
    spreadsheetId: activeSpreadsheetId,
    sheetName: activeSheetName,
    hasServiceAccount,
    serviceAccountEmail: activeServiceAccountJson?.client_email || null,
    statusText: isConfigured ? 'Configurado' : 'Google Sheets no configurado',
  };
}

export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  // If it's a full Google Sheets URL: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Resolves an access token either from a passed bearer token or from the Service Account JSON.
 */
async function getAccessToken(userToken?: string): Promise<string> {
  if (userToken && userToken.trim().length > 10) {
    return userToken.replace(/^Bearer\s+/i, '').trim();
  }

  if (activeServiceAccountJson && activeServiceAccountJson.client_email && activeServiceAccountJson.private_key) {
    const client = new JWT({
      email: activeServiceAccountJson.client_email,
      key: activeServiceAccountJson.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const tokens = await client.authorize();
    if (!tokens.access_token) {
      throw new Error('Google Sheets: No se pudo obtener el token de acceso de la Cuenta de Servicio.');
    }
    return tokens.access_token;
  }

  throw new Error(
    'Google Sheets no configurado: Falta la Cuenta de Servicio de Google Cloud (archivo JSON) o credencial de acceso.'
  );
}

/**
 * Verifies that the Google Sheet exists, reads its title, and inspects the first row for headers.
 */
export async function verifyGoogleSheet(userToken?: string) {
  const spreadsheetId = activeSpreadsheetId;
  if (!spreadsheetId) {
    return {
      connected: false,
      configured: false,
      message: 'Google Sheets no configurado: Falta el ID o enlace de la hoja de cálculo.',
      headersMatch: false,
    };
  }

  if (!activeServiceAccountJson && (!userToken || userToken.trim().length <= 10)) {
    return {
      connected: false,
      configured: false,
      message: 'Google Sheets no configurado: Falta la Cuenta de Servicio (JSON) para conectarse a Google Sheets.',
      headersMatch: false,
    };
  }

  try {
    const token = await getAccessToken(userToken);

    // 1. Fetch metadata about spreadsheet
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!metaRes.ok) {
      const errorText = await metaRes.text();
      let msg = `Error al conectar con Google Sheets (HTTP ${metaRes.status})`;
      if (metaRes.status === 404) {
        msg = 'No se encontró la hoja de cálculo. Verifica que el ID sea correcto.';
      } else if (metaRes.status === 403) {
        msg = 'Permiso denegado. Asegúrate de compartir la hoja con la Cuenta de Servicio o autorizar tu usuario.';
      }
      return {
        connected: false,
        message: `${msg}: ${errorText.slice(0, 160)}`,
        headersMatch: false,
      };
    }

    const metaData = await metaRes.json();
    const sheetTitle = metaData.properties?.title || 'Hoja sin título';
    const availableSheets = (metaData.sheets || []).map((s: any) => s.properties?.title);

    // Determine target sheet tab name
    let targetSheet = activeSheetName;
    if (!availableSheets.includes(targetSheet) && availableSheets.length > 0) {
      targetSheet = availableSheets[0];
      activeSheetName = targetSheet;
    }

    // 2. Fetch row 1 to verify headers
    const range = encodeURIComponent(`'${targetSheet}'!A1:J1`);
    const valRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    let existingHeaders: string[] = [];
    let headersMatch = false;
    let missingHeaders: string[] = [];

    if (valRes.ok) {
      const valData = await valRes.json();
      existingHeaders = (valData.values && valData.values[0]) || [];

      // Check against REQUIRED_COLUMNS:
      // 1. FECHA, 2. TECNICO, 3. TIPO, 4. CODIGO, 5. OT, 6. NOMBRES, 7. N° ORDEN PHOENIX, 8. NODO, 9. ESTADO, 10. OBSERVACION
      headersMatch =
        existingHeaders.length >= REQUIRED_COLUMNS.length &&
        REQUIRED_COLUMNS.every((col, idx) => {
          const current = (existingHeaders[idx] || '').trim().toUpperCase();
          const expected = col.toUpperCase();
          return current === expected;
        });

      if (!headersMatch) {
        missingHeaders = REQUIRED_COLUMNS.filter((col, idx) => {
          const current = (existingHeaders[idx] || '').trim().toUpperCase();
          return current !== col.toUpperCase();
        });
      }
    }

    return {
      connected: true,
      sheetTitle,
      targetSheet,
      availableSheets,
      headersMatch,
      existingHeaders,
      missingHeaders,
      canWrite: true,
      message: headersMatch
        ? `Conexión exitosa a "${sheetTitle}" (${targetSheet}). Encabezados verificados y correctos.`
        : `Conectado a "${sheetTitle}", pero los encabezados de la fila 1 no coinciden exactamente. Haz clic en "Inicializar Encabezados" para escribirlos automáticamente.`,
    };
  } catch (error: any) {
    return {
      connected: false,
      message: error.message || 'Error desconocido al verificar Google Sheets',
      headersMatch: false,
    };
  }
}

/**
 * Initializes the 10 standard columns in Row 1 of the target Google Sheet.
 */
export async function initializeHeaders(userToken?: string) {
  const spreadsheetId = activeSpreadsheetId;
  if (!spreadsheetId) {
    throw new Error('No hay ID de hoja configurado.');
  }

  const token = await getAccessToken(userToken);
  const targetSheet = activeSheetName || 'Hoja 1';
  const range = encodeURIComponent(`'${targetSheet}'!A1:J1`);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `'${targetSheet}'!A1:J1`,
        majorDimension: 'ROWS',
        values: [[...REQUIRED_COLUMNS]],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Error al inicializar encabezados: ${err.slice(0, 160)}`);
  }

  return {
    success: true,
    message: 'Encabezados oficiales inicializados correctamente en la fila 1.',
  };
}

/**
 * Appends approved records to the Google Sheet.
 * Enforces:
 * - Exact 10 columns in order
 * - OBSERVACION is strictly empty ""
 * - Idempotency to prevent duplicate append on retries
 */
export async function appendRecordsToGoogleSheet(
  records: SheetRowRecord[],
  userToken?: string
) {
  const spreadsheetId = activeSpreadsheetId;
  if (!spreadsheetId) {
    throw new Error('Google Sheets no configurado: Falta el ID o URL de la hoja de cálculo en la sección de Configuración.');
  }

  if (!records || records.length === 0) {
    return {
      success: true,
      savedCount: 0,
      failedCount: 0,
      insertedIds: [],
      alreadySavedIds: [],
      message: 'No se enviaron registros para guardar.',
      timestamp: new Date().toISOString(),
    };
  }

  const token = await getAccessToken(userToken);
  const targetSheet = activeSheetName || 'Hoja 1';

  // Check for duplicates via idempotency fingerprints
  const recordsToInsert: SheetRowRecord[] = [];
  const alreadySavedIds: string[] = [];

  for (const record of records) {
    const fp = generateFingerprint(record);
    if (savedOrdersFingerprints.has(fp)) {
      alreadySavedIds.push(record.id || fp);
    } else {
      recordsToInsert.push(record);
    }
  }

  if (recordsToInsert.length === 0) {
    return {
      success: true,
      savedCount: 0,
      failedCount: 0,
      insertedIds: [],
      alreadySavedIds,
      message: 'Todos los registros seleccionados ya fueron guardados previamente (evitado por idempotencia).',
      timestamp: new Date().toISOString(),
    };
  }

  // Format each row strictly to the 10 columns in exact order
  const rows = recordsToInsert.map((rec) => [
    rec.fecha || '',
    rec.tecnico || '',
    rec.tipo || '',
    rec.codigo || '',
    rec.ot || '',
    rec.nombres || '',
    rec.ordenPhoenix || '',
    rec.nodo || '',
    rec.estado || '',
    '', // OBSERVACION: MANDATORY strictly empty string
  ]);

  const range = encodeURIComponent(`'${targetSheet}'!A:J`);
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: `'${targetSheet}'!A:J`,
      majorDimension: 'ROWS',
      values: rows,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error de Google Sheets al insertar filas (${response.status}): ${errText.slice(0, 200)}`);
  }

  // Record fingerprints into idempotency cache
  const insertedIds: string[] = [];
  for (const rec of recordsToInsert) {
    const fp = generateFingerprint(rec);
    savedOrdersFingerprints.add(fp);
    insertedIds.push(rec.id || fp);
  }

  return {
    success: true,
    savedCount: recordsToInsert.length,
    failedCount: 0,
    insertedIds,
    alreadySavedIds,
    message: `Se registraron exitosamente ${recordsToInsert.length} orden(es) en Google Sheets.`,
    timestamp: new Date().toISOString(),
  };
}
