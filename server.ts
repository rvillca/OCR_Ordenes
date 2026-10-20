import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { processImageWithGemini } from './src/server/geminiOcr.js';
import {
  verifyGoogleSheet,
  initializeHeaders,
  appendRecordsToGoogleSheet,
  getGoogleSheetsConfig,
  setGoogleSheetsConfig,
} from './src/server/googleSheets.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parser with 50MB limit to handle high-resolution photos
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to extract bearer token from header
function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return undefined;
}

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

// ==========================================
// API ROUTES
// ==========================================

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Config status
app.get('/api/config/status', (_req: Request, res: Response) => {
  const sheetsConfig = getGoogleSheetsConfig();
  res.json({
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    sheets: sheetsConfig,
  });
});

// Update sheets config
app.post('/api/config/update', (req: Request, res: Response) => {
  try {
    const { spreadsheetId, sheetName, serviceAccountJson } = req.body;
    setGoogleSheetsConfig({
      spreadsheetId,
      sheetName,
      serviceAccountJson,
    });
    res.json({
      success: true,
      message: 'Configuración actualizada correctamente',
      sheets: getGoogleSheetsConfig(),
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// OCR analysis endpoint
app.post('/api/ocr/analyze', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType, filename } = req.body;

    if (!imageBase64) {
      res.status(400).json({
        success: false,
        message: 'No se suministró ninguna imagen para analizar.',
      });
      return;
    }

    const cleanMime = (mimeType || 'image/jpeg').toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(cleanMime)) {
      res.status(400).json({
        success: false,
        message: `Tipo de archivo no permitido: ${cleanMime}. Formatos aceptados: JPG, JPEG, PNG, WEBP.`,
      });
      return;
    }

    // Size validation in server (approx base64 length in bytes)
    const approximateBytes = (imageBase64.length * 3) / 4;
    const MAX_BYTES = 25 * 1024 * 1024; // 25MB
    if (approximateBytes > MAX_BYTES) {
      res.status(400).json({
        success: false,
        message: 'La imagen excede el límite máximo permitido de 25MB.',
      });
      return;
    }

    const ocrResult = await processImageWithGemini(imageBase64, cleanMime);
    res.json(ocrResult);
  } catch (error: any) {
    console.error('Error processing OCR request:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error interno del servidor durante el OCR.',
    });
  }
});

// Verify Google Sheet
app.post('/api/sheets/verify', async (req: Request, res: Response) => {
  try {
    const userToken = extractBearerToken(req);
    const { spreadsheetId, sheetName } = req.body || {};
    if (spreadsheetId) {
      setGoogleSheetsConfig({ spreadsheetId, sheetName });
    }
    const result = await verifyGoogleSheet(userToken);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      connected: false,
      message: error.message || 'Error al conectar con Google Sheets.',
      headersMatch: false,
    });
  }
});

// Initialize official 10 headers in Row 1
app.post('/api/sheets/init-headers', async (req: Request, res: Response) => {
  try {
    const userToken = extractBearerToken(req);
    const result = await initializeHeaders(userToken);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al inicializar encabezados.',
    });
  }
});

// Append approved records to Google Sheet
app.post('/api/sheets/append', async (req: Request, res: Response) => {
  try {
    const userToken = extractBearerToken(req);
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No se recibieron registros para guardar en Google Sheets.',
      });
      return;
    }

    // CRITICAL: Reject any record that is NOT approved by the user
    const unapproved = records.filter((r: any) => !r.approved);
    if (unapproved.length > 0) {
      res.status(400).json({
        success: false,
        message: `Acción bloqueada: ${unapproved.length} de los registros no cuentan con aprobación explícita del usuario. Solo se pueden guardar registros aprobados.`,
      });
      return;
    }

    // Force OBSERVACION to be strictly empty
    const sanitizedRecords = records.map((r: any) => ({
      ...r,
      observacion: '', // ALWAYS EMPTY STRING per specification
    }));

    const result = await appendRecordsToGoogleSheet(sanitizedRecords, userToken);
    res.json(result);
  } catch (error: any) {
    console.error('Error appending records to Google Sheets:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al registrar las órdenes en Google Sheets.',
    });
  }
});

// ==========================================
// VITE / STATIC SERVING
// ==========================================
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Dynamic import to prevent bundler issues
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
