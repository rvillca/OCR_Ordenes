/**
 * Utility to generate realistic canvas-rendered technical work order images
 * for testing the Gemini OCR without needing a physical document.
 */

export function generateSampleOrderImage(type: 'single' | 'double' | 'blurry'): Promise<{ base64: string; name: string }> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    if (type === 'double') {
      canvas.width = 900;
      canvas.height = 1100;

      // Background paper tone
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header company
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(30, 20, 840, 50);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('TELECOM REDES DEL SUR - PLANILLA DE ÓRDENES TÉCNICAS', 50, 52);

      // Order 1
      drawOrderBox(ctx, 40, 90, 820, 460, {
        title: 'ORDEN TÉCNICA #1 - FIBRA ÓPTICA',
        fecha: '16/10/2026',
        tecnico: 'CARLOS MARIO RAMIREZ H.',
        tipo: 'INSTALACIÓN DE FIBRA 500MB',
        codigo: 'CLI-847291',
        ot: 'OT-984210',
        nombres: 'MARIA ELENA GOMEZ CASTILLO',
        phoenix: 'PHX-7740192',
        nodo: 'NODO-SUD-04',
        estado: 'EJECUTADA',
      });

      // Order 2
      drawOrderBox(ctx, 40, 580, 820, 460, {
        title: 'ORDEN TÉCNICA #2 - REPARACIÓN DE RED',
        fecha: '16/10/2026',
        tecnico: 'JORGE LUIS MENDEZ T.',
        tipo: 'REPARACIÓN POR CORTE DE FIBRA',
        codigo: 'CLI-552094',
        ot: 'OT-984211',
        nombres: 'ROBERTO CARLOS SILVA PEÑA',
        phoenix: 'PHX-8831024',
        nodo: 'NODO-NORTE-12',
        estado: 'PENDIENTE',
      });

      const base64 = canvas.toDataURL('image/jpeg', 0.92);
      resolve({ base64, name: 'Planilla_Multiple_Ordenes_16Oct.jpg' });
    } else if (type === 'blurry') {
      canvas.width = 800;
      canvas.height = 700;

      ctx.fillStyle = '#eaeaea';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Low contrast and blurry-like effect
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'italic 16px sans-serif';
      ctx.fillText('DOCUMENTO ARRUGA / BAJA LUZ', 50, 40);

      drawOrderBox(ctx, 40, 60, 720, 580, {
        title: 'BOLETA TECNICA MANTENIMIENTO (ILEGIBLE PARCIAL)',
        fecha: '15/10/2026',
        tecnico: 'TEC. DESCONOCIDO',
        tipo: 'MIGRACION TECNOLOGICA',
        codigo: 'CLI-???331',
        ot: 'OT-44011',
        nombres: 'JUAN PEREZ (BORROSO)',
        phoenix: '',
        nodo: 'ND-08',
        estado: 'FINALIZADA',
      });

      // Overlay slight wash to simulate poor lighting
      ctx.fillStyle = 'rgba(200, 200, 200, 0.45)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const base64 = canvas.toDataURL('image/jpeg', 0.6);
      resolve({ base64, name: 'Orden_Foto_Baja_Luz_15Oct.jpg' });
    } else {
      // Single clean order
      canvas.width = 850;
      canvas.height = 750;

      // Realistic paper
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(30, 25, 790, 60);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('CERTIFICADO DE TRABAJO TÉCNICO', 50, 62);

      drawOrderBox(ctx, 35, 105, 780, 600, {
        title: 'COMPROBANTE DE ATENCIÓN TÉCNICA EN DOMICILIO',
        fecha: '17/10/2026',
        tecnico: 'GUSTAVO ADOLFO MORALES S.',
        tipo: 'INSTALACION NUEVA SERVICIO FTTH',
        codigo: 'CLI-990145',
        ot: 'OT-104928',
        nombres: 'ANA LUCIA MARTINEZ BARRERA',
        phoenix: 'PHX-9004128',
        nodo: 'NODO-CENTRAL-01',
        estado: 'EJECUTADA',
      });

      const base64 = canvas.toDataURL('image/jpeg', 0.95);
      resolve({ base64, name: 'Orden_Tecnica_OT-104928.jpg' });
    }
  });
}

function drawOrderBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  data: {
    title: string;
    fecha: string;
    tecnico: string;
    tipo: string;
    codigo: string;
    ot: string;
    nombres: string;
    phoenix: string;
    nodo: string;
    estado: string;
  }
) {
  // Border box
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  // Title bar
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(x + 1, y + 1, w - 2, 38);
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(data.title, x + 15, y + 26);

  // Grid fields
  const fields = [
    { label: 'FECHA DE EJECUCIÓN:', val: data.fecha, col: 0, row: 0 },
    { label: 'TÉCNICO / CUADRILLA:', val: data.tecnico, col: 1, row: 0 },
    { label: 'TIPO DE TRABAJO:', val: data.tipo, col: 0, row: 1 },
    { label: 'CÓDIGO DE ABONADO:', val: data.codigo, col: 1, row: 1 },
    { label: 'N° ORDEN DE TRABAJO (OT):', val: data.ot, col: 0, row: 2, highlight: true },
    { label: 'N° ORDEN PHOENIX:', val: data.phoenix || '(NO REGISTRA)', col: 1, row: 2, highlight: true },
    { label: 'NOMBRES DEL CLIENTE:', val: data.nombres, col: 0, row: 3 },
    { label: 'NODO / TERMINAL ÓPTICA:', val: data.nodo, col: 1, row: 3 },
    { label: 'ESTADO DE LA ORDEN:', val: data.estado, col: 0, row: 4 },
    { label: 'OBSERVACIONES TÉCNICAS:', val: '--- (SIN OBSERVACIONES) ---', col: 1, row: 4 },
  ];

  const colWidth = (w - 30) / 2;
  const rowHeight = 75;
  const startY = y + 55;

  fields.forEach((f) => {
    const fx = x + 15 + f.col * colWidth;
    const fy = startY + f.row * rowHeight;

    // Field container
    ctx.fillStyle = f.highlight ? '#f1f5f9' : '#ffffff';
    ctx.fillRect(fx, fy, colWidth - 10, rowHeight - 12);
    ctx.strokeStyle = f.highlight ? '#3b82f6' : '#cbd5e1';
    ctx.lineWidth = f.highlight ? 1.5 : 1;
    ctx.strokeRect(fx, fy, colWidth - 10, rowHeight - 12);

    // Label
    ctx.fillStyle = f.highlight ? '#1d4ed8' : '#64748b';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(f.label, fx + 8, fy + 18);

    // Value
    ctx.fillStyle = '#0f172a';
    ctx.font = f.highlight ? 'bold 15px monospace' : 'bold 13px sans-serif';
    ctx.fillText(f.val, fx + 8, fy + 42);
  });

  // Stamp at the bottom
  ctx.save();
  ctx.translate(x + w - 160, y + h - 50);
  ctx.rotate(-0.08);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(0, 0, 140, 40);
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('REVISADO - OK', 14, 25);
  ctx.restore();
}
