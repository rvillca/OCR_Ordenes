import { GoogleGenAI, Type } from '@google/genai';

// Initialize Gemini client strictly with User-Agent header as required
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada en las variables de entorno.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

export interface ExtractedOrderData {
  fecha: string;
  tecnico: string;
  tipo: string;
  codigo: string;
  ot: string;
  nombres: string;
  ordenPhoenix: string;
  nodo: string;
  estado: string;
  observacion: string; // Must always be ""
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
}

export interface OcrResult {
  success: boolean;
  orders: ExtractedOrderData[];
  isBlurry: boolean;
  warningMessage?: string;
  rawNotes?: string;
}

export async function processImageWithGemini(
  base64Data: string,
  mimeType: string
): Promise<OcrResult> {
  const ai = getGeminiClient();

  const prompt = `
Actúa como un sistema experto de OCR y extracción documental para órdenes de trabajo técnicas (telecomunicaciones, fibra óptica, servicios domiciliarios e infraestructura).

INSTRUCCIONES OBLIGATORIAS:
1. Examina minuciosamente la fotografía suministrada.
2. Si la fotografía contiene MÚLTIPLES órdenes técnicas (por ejemplo, varias boletas, planillas con varias filas, talonarios o listas de servicios), extrae CADA orden por separado como un elemento individual del arreglo.
3. Si la fotografía contiene una sola orden, devuelve un arreglo con ese único elemento.
4. Si la imagen es completamente ilegible, borrosa, cortada o no contiene una orden identificable, indícalo claramente con isBlurry = true y añade advertencias en warnings.
5. REGLAS ESTRICTAS DE CAMPOS:
   - FECHA: Fecha de la orden o ejecución (ej: "15/10/2026", "2026-10-15"). Si no aparece, dejar "".
   - TECNICO: Nombre completo o código del técnico/cuadrilla que realizó el trabajo. Si no aparece, dejar "".
   - TIPO: Tipo de trabajo o solicitud (ej: "INSTALACIÓN", "REPARACIÓN", "MIGRACIÓN", "BAJA", "RECONEXIÓN", "AVERÍA"). Si no aparece, dejar "".
   - CODIGO: Código de abonado, cliente o contrato (ej: "CLI-98210", "1029384"). Si no aparece, dejar "".
   - OT: Número de orden de trabajo (identificado como OT, O.T., N° OT, Orden de Trabajo). Si no aparece, dejar "".
   - NOMBRES: Nombres y apellidos del cliente o titular de la orden. Si no aparece, dejar "".
   - N° ORDEN PHOENIX: Número específico de orden Phoenix (identificado explícitamente como "Phoenix", "N° Phoenix", "Orden Phoenix", etc.). CRÍTICO: ¡NO confundir con el campo OT! Son campos diferentes. Si no tiene orden Phoenix, dejar "".
   - NODO: Nodo, central, terminal o zona técnica (ej: "NODO-04", "B12-NORTE", "OLT-01"). Si no aparece, dejar "".
   - ESTADO: Estado de la orden (ej: "EJECUTADA", "LIQUIDADA", "PENDIENTE", "CANCELADA", "CERRADA"). Si no aparece, dejar "".
   - OBSERVACION: SIEMPRE DEBE SER UNA CADENA VACÍA "". NUNCA extraigas, infieras ni agregues nada en OBSERVACION.

6. NO INVENTES INFORMACIÓN. Si un dato no es 100% visible o certero, déjalo vacío ("") y marca su estado como "uncertain" o "empty".
`;

  try {
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType || 'image/jpeg',
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isBlurry: {
              type: Type.BOOLEAN,
              description: 'Verdadero si la imagen está borrosa, desenfocada, con baja luz o difícil de leer',
            },
            generalNotes: {
              type: Type.STRING,
              description: 'Comentario general sobre la calidad y legibilidad de la fotografía',
            },
            orders: {
              type: Type.ARRAY,
              description: 'Lista de órdenes técnicas detectadas en la fotografía',
              items: {
                type: Type.OBJECT,
                properties: {
                  fecha: { type: Type.STRING, description: 'Fecha de la orden o vacía si no existe' },
                  tecnico: { type: Type.STRING, description: 'Nombre o código del técnico' },
                  tipo: { type: Type.STRING, description: 'Tipo de trabajo o solicitud' },
                  codigo: { type: Type.STRING, description: 'Código de cliente/contrato' },
                  ot: { type: Type.STRING, description: 'Número de OT (Orden de Trabajo)' },
                  nombres: { type: Type.STRING, description: 'Nombres y apellidos del abonado/cliente' },
                  ordenPhoenix: { type: Type.STRING, description: 'N° de orden Phoenix (distinto a OT)' },
                  nodo: { type: Type.STRING, description: 'Nodo o sector de telecomunicaciones' },
                  estado: { type: Type.STRING, description: 'Estado de la orden (ej. Ejecutada, Pendiente)' },
                  observacion: { type: Type.STRING, description: 'Siempre cadena vacía' },
                  confidence: {
                    type: Type.STRING,
                    description: 'Nivel general de confianza para esta orden: high, medium o low',
                  },
                  warnings: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Advertencias específicas (campos dudosos, manchas, etc.)',
                  },
                  fieldStatus: {
                    type: Type.OBJECT,
                    description: 'Calidad de detección de cada campo individual',
                    properties: {
                      fecha: { type: Type.STRING, description: 'valid, empty, o uncertain' },
                      tecnico: { type: Type.STRING, description: 'valid, empty, o uncertain' },
                      tipo: { type: Type.STRING, description: 'valid, empty, o uncertain' },
                      codigo: { type: Type.STRING, description: 'valid, empty, o uncertain' },
                      ot: { type: Type.STRING, description: 'valid, empty, o uncertain' },
                      nombres: { type: Type.STRING, description: 'valid, empty, o uncertain' },
                      ordenPhoenix: { type: Type.STRING, description: 'valid, empty, o uncertain' },
                      nodo: { type: Type.STRING, description: 'valid, empty, o uncertain' },
                      estado: { type: Type.STRING, description: 'valid, empty, o uncertain' },
                    },
                    required: ['fecha', 'tecnico', 'tipo', 'codigo', 'ot', 'nombres', 'ordenPhoenix', 'nodo', 'estado'],
                  },
                },
                required: [
                  'fecha',
                  'tecnico',
                  'tipo',
                  'codigo',
                  'ot',
                  'nombres',
                  'ordenPhoenix',
                  'nodo',
                  'estado',
                  'observacion',
                  'confidence',
                  'warnings',
                  'fieldStatus',
                ],
              },
            },
          },
          required: ['isBlurry', 'generalNotes', 'orders'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini no devolvió ninguna respuesta');
    }

    const parsed = JSON.parse(text);

    // Enforce strict constraint: OBSERVACION is ALWAYS an empty string
    const sanitizedOrders: ExtractedOrderData[] = (parsed.orders || []).map((ord: any) => ({
      fecha: (ord.fecha || '').trim(),
      tecnico: (ord.tecnico || '').trim(),
      tipo: (ord.tipo || '').trim(),
      codigo: (ord.codigo || '').trim(),
      ot: (ord.ot || '').trim(),
      nombres: (ord.nombres || '').trim(),
      ordenPhoenix: (ord.ordenPhoenix || '').trim(),
      nodo: (ord.nodo || '').trim(),
      estado: (ord.estado || '').trim(),
      observacion: '', // Strictly empty per specification
      confidence: (['high', 'medium', 'low'].includes(ord.confidence) ? ord.confidence : 'medium') as any,
      warnings: Array.isArray(ord.warnings) ? ord.warnings : [],
      fieldStatus: {
        fecha: ord.fieldStatus?.fecha || (ord.fecha ? 'valid' : 'empty'),
        tecnico: ord.fieldStatus?.tecnico || (ord.tecnico ? 'valid' : 'empty'),
        tipo: ord.fieldStatus?.tipo || (ord.tipo ? 'valid' : 'empty'),
        codigo: ord.fieldStatus?.codigo || (ord.codigo ? 'valid' : 'empty'),
        ot: ord.fieldStatus?.ot || (ord.ot ? 'valid' : 'empty'),
        nombres: ord.fieldStatus?.nombres || (ord.nombres ? 'valid' : 'empty'),
        ordenPhoenix: ord.fieldStatus?.ordenPhoenix || (ord.ordenPhoenix ? 'valid' : 'empty'),
        nodo: ord.fieldStatus?.nodo || (ord.nodo ? 'valid' : 'empty'),
        estado: ord.fieldStatus?.estado || (ord.estado ? 'valid' : 'empty'),
      },
    }));

    return {
      success: true,
      orders: sanitizedOrders,
      isBlurry: Boolean(parsed.isBlurry),
      warningMessage: parsed.isBlurry ? parsed.generalNotes || 'Imagen con baja nitidez o borrosa' : undefined,
      rawNotes: parsed.generalNotes,
    };
  } catch (error: any) {
    console.error('Error in processImageWithGemini:', error);
    return {
      success: false,
      orders: [],
      isBlurry: false,
      warningMessage: error.message || 'Error al procesar la imagen con Gemini',
    };
  }
}
