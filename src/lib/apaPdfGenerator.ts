import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  APA_REFERENCES,
  RISK_MATRIX,
  TECHNOLOGY_COMPARISON,
  WORKFLOW_NODES,
} from '../data/projectContent';
import {
  ExecutionLog,
  ReportFigureScreenshots,
  RoiParameters,
  StudentMetadata,
} from '../types/automation';

interface GenerateApaPdfOptions {
  metadata: StudentMetadata;
  roi: RoiParameters;
  logs: ExecutionLog[];
  screenshots: ReportFigureScreenshots;
  bpmnSvgElement: SVGSVGElement | null;
}

export interface GeneratedPdfResult {
  fileName: string;
  totalPages: number;
  bodyPages: number;
}

function sanitizePdfText(input: string): string {
  return input
    .replace(/→/g, '->')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/•/g, '-')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

async function svgElementToPngDataUrl(
  svgEl: SVGSVGElement | null
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!svgEl) return null;
  try {
    const targetWidth = 1680;
    const targetHeight = 840;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(targetWidth));
    clone.setAttribute('height', String(targetHeight));

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);

    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
      image.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    URL.revokeObjectURL(url);

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: targetWidth,
      height: targetHeight,
    };
  } catch {
    return null;
  }
}

async function getImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number; format: 'PNG' | 'JPEG' } | null> {
  if (!dataUrl) return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
      image.src = dataUrl;
    });
    const format: 'PNG' | 'JPEG' = dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')
      ? 'JPEG'
      : 'PNG';
    return {
      width: img.naturalWidth || 1200,
      height: img.naturalHeight || 675,
      format,
    };
  } catch {
    return null;
  }
}

export async function generateAndDownloadApaPdf(
  options: GenerateApaPdfOptions
): Promise<GeneratedPdfResult> {
  const { metadata, roi, logs, screenshots, bpmnSvgElement } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
    compress: true,
  });

  const PAGE_WIDTH = 612;
  const PAGE_HEIGHT = 792;
  const MARGIN = 72; // 1 inch APA 7th ed.
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 468 pt
  const MAX_Y = PAGE_HEIGHT - MARGIN; // 720 pt
  const LINE_HEIGHT = 23; // Double-spaced APA cadence for 12pt Times
  const FIRST_LINE_INDENT = 36; // 0.5 inch APA indent

  let y = MARGIN;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > MAX_Y) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const addCenteredTitle = (text: string, fontSize = 14) => {
    doc.setFont('times', 'bold');
    doc.setFontSize(fontSize);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(sanitizePdfText(text), CONTENT_WIDTH) as string[];
    ensureSpace(lines.length * (fontSize + 8) + 8);
    for (const line of lines) {
      doc.text(line, PAGE_WIDTH / 2, y, { align: 'center' });
      y += fontSize + 8;
    }
    y += 6;
  };

  const addSectionHeading = (text: string, startOnNewPage = false) => {
    if (startOnNewPage) {
      doc.addPage();
      y = MARGIN;
    } else {
      ensureSpace(56);
    }
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(sanitizePdfText(text), CONTENT_WIDTH) as string[];
    for (const line of lines) {
      doc.text(line, PAGE_WIDTH / 2, y, { align: 'center' });
      y += 20;
    }
    y += 6;
  };

  const addSubHeading = (text: string) => {
    ensureSpace(46);
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(sanitizePdfText(text), CONTENT_WIDTH) as string[];
    for (const line of lines) {
      doc.text(line, MARGIN, y);
      y += 20;
    }
    y += 2;
  };

  const addParagraph = (rawText: string, indent = true) => {
    const text = sanitizePdfText(rawText).trim();
    if (!text) return;

    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);

    const words = text.split(/\s+/);
    const lines: Array<{ text: string; indented: boolean }> = [];
    let currentLine = '';
    let isFirstLine = true;

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const limit = isFirstLine && indent ? CONTENT_WIDTH - FIRST_LINE_INDENT : CONTENT_WIDTH;
      if (doc.getTextWidth(candidate) <= limit || !currentLine) {
        currentLine = candidate;
      } else {
        lines.push({ text: currentLine, indented: isFirstLine && indent });
        isFirstLine = false;
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push({ text: currentLine, indented: isFirstLine && indent });
    }

    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);
      const xPos = line.indented ? MARGIN + FIRST_LINE_INDENT : MARGIN;
      doc.text(line.text, xPos, y);
      y += LINE_HEIGHT;
    }
    y += 4;
  };

  const addHangingReference = (rawCitation: string) => {
    const text = sanitizePdfText(rawCitation).trim();
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);

    const words = text.split(/\s+/);
    const lines: Array<{ text: string; isFirst: boolean }> = [];
    let currentLine = '';
    let isFirst = true;

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const limit = isFirst ? CONTENT_WIDTH : CONTENT_WIDTH - FIRST_LINE_INDENT;
      if (doc.getTextWidth(candidate) <= limit || !currentLine) {
        currentLine = candidate;
      } else {
        lines.push({ text: currentLine, isFirst });
        isFirst = false;
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push({ text: currentLine, isFirst });
    }

    ensureSpace(lines.length * LINE_HEIGHT + 6);
    for (const line of lines) {
      const xPos = line.isFirst ? MARGIN : MARGIN + FIRST_LINE_INDENT;
      doc.text(line.text, xPos, y);
      y += LINE_HEIGHT;
    }
    y += 6;
  };

  const addApaTable = (
    tableNum: string,
    tableTitle: string,
    head: string[],
    body: string[][],
    columnStyles?: Record<number, { cellWidth?: number; halign?: 'left' | 'right' | 'center' }>
  ) => {
    ensureSpace(120);
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(tableNum), MARGIN, y);
    y += 16;

    doc.setFont('times', 'italic');
    doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(sanitizePdfText(tableTitle), CONTENT_WIDTH) as string[];
    for (const line of titleLines) {
      doc.text(line, MARGIN, y);
      y += 15;
    }
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN },
      head: [head.map(sanitizePdfText)],
      body: body.map((row) => row.map(sanitizePdfText)),
      theme: 'plain',
      styles: {
        font: 'times',
        fontSize: 9.5,
        cellPadding: { top: 5, right: 5, bottom: 5, left: 4 },
        textColor: [15, 23, 42],
        overflow: 'linebreak',
        lineColor: [203, 213, 225],
        lineWidth: 0,
      },
      headStyles: {
        fontStyle: 'bold',
        fillColor: false,
        textColor: [15, 23, 42],
        lineWidth: { top: 1, bottom: 1 },
        lineColor: [15, 23, 42],
      },
      bodyStyles: {
        valign: 'top',
      },
      columnStyles,
      didDrawPage: () => {
        // Page numbers will be stamped globally after full generation
      },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 60;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(1);
    doc.line(MARGIN, finalY, PAGE_WIDTH - MARGIN, finalY);
    y = finalY + 22;
  };

  const addFigureFromImage = async (
    figNum: string,
    figTitle: string,
    noteText: string,
    imageDataUrl: string,
    naturalW: number,
    naturalH: number,
    format: 'PNG' | 'JPEG'
  ) => {
    const ratio = naturalH / naturalW;
    const maxImgHeight = 290;
    let drawW = CONTENT_WIDTH;
    let drawH = drawW * ratio;
    if (drawH > maxImgHeight) {
      drawH = maxImgHeight;
      drawW = drawH / ratio;
    }

    ensureSpace(drawH + 95);

    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(figNum), MARGIN, y);
    y += 16;

    doc.setFont('times', 'italic');
    doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(sanitizePdfText(figTitle), CONTENT_WIDTH) as string[];
    for (const line of titleLines) {
      doc.text(line, MARGIN, y);
      y += 15;
    }
    y += 4;

    const xOffset = MARGIN + (CONTENT_WIDTH - drawW) / 2;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.75);
    doc.rect(xOffset - 2, y - 2, drawW + 4, drawH + 4);
    doc.addImage(imageDataUrl, format, xOffset, y, drawW, drawH);
    y += drawH + 16;

    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const noteLines = doc.splitTextToSize(sanitizePdfText(noteText), CONTENT_WIDTH) as string[];
    for (const line of noteLines) {
      doc.text(line, MARGIN, y);
      y += 14;
    }
    y += 10;
  };

  // Quantitave ROI calculations matching ProcessAnalysisView & AcademicReportView
  const manualHoursMonth = (roi.monthlyInvoices * roi.manualMinutesPerInvoice) / 60;
  const automatedHoursMonth = (roi.monthlyInvoices * roi.automatedMinutesPerInvoice) / 60;
  const hoursSavedMonth = Math.max(0, manualHoursMonth - automatedHoursMonth);
  const timeReductionPct =
    roi.manualMinutesPerInvoice > 0
      ? ((roi.manualMinutesPerInvoice - roi.automatedMinutesPerInvoice) /
          roi.manualMinutesPerInvoice) *
        100
      : 0;
  const monthlyErrorsManual = (roi.monthlyInvoices * roi.manualErrorRatePercent) / 100;
  const reworkSavingsMonth = (monthlyErrorsManual - monthlyErrorsManual * 0.08) * roi.errorReworkCostCop;
  const laborSavingsMonth = hoursSavedMonth * roi.analystHourlyCostCop;
  const totalMonthlySavingsCop = laborSavingsMonth + reworkSavingsMonth;
  const annualSavingsCop = totalMonthlySavingsCop * 12;

  const successLog = logs.find((l) => l.scenarioType !== 'controlled_error') ?? logs[0];
  const errorLog = logs.find((l) => l.scenarioType === 'controlled_error') ?? logs[1];

  // =========================================================
  // PAGE 1: PORTADA (APA 7th Ed.)
  // =========================================================
  y = 140;
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(
    sanitizePdfText('Actividad: Custodios de la Innovación — Forjando Conexiones Avanzadas'),
    PAGE_WIDTH / 2,
    y,
    { align: 'center' }
  );

  y = 260;
  addCenteredTitle(metadata.projectTitle, 15);

  y += 30;
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  const coverDetails = [
    metadata.studentName,
    metadata.institution,
    metadata.courseName,
    '',
    metadata.date,
  ];
  for (const item of coverDetails) {
    if (item) {
      doc.text(sanitizePdfText(item), PAGE_WIDTH / 2, y, { align: 'center' });
    }
    y += 24;
  }

  y = 650;
  doc.setDrawColor(203, 213, 225);
  doc.line(MARGIN + 40, y, PAGE_WIDTH - MARGIN - 40, y);
  y += 20;
  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.text(
    sanitizePdfText('Enlace de sustentación oral en video (YouTube — visualización restringida):'),
    PAGE_WIDTH / 2,
    y,
    { align: 'center' }
  );
  y += 16;
  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(29, 78, 216);
  doc.text(sanitizePdfText(metadata.youtubeUrl), PAGE_WIDTH / 2, y, { align: 'center' });

  // =========================================================
  // BODY START (Page 2+)
  // =========================================================
  doc.addPage();
  y = MARGIN;
  addCenteredTitle(metadata.projectTitle, 13);

  // SECCIÓN 1: INTRODUCCIÓN
  addSectionHeading('1. Introducción', false);
  addSubHeading('1.1 Contextualización del problema');
  addParagraph(
    'En las organizaciones contemporáneas, la transformación digital ha dejado de ser una iniciativa accesoria para consolidarse como un imperativo de competitividad, trazabilidad y control interno. Sin embargo, múltiples áreas administrativas y financieras continúan operando bajo esquemas fragmentados en los cuales el talento humano invierte una proporción significativa de su jornada en tareas repetitivas de transcripción, validación documental y conciliación entre sistemas que no se comunican de manera nativa (Hammer & Champy, 1993; vom Brocke & Rosemann, 2015). Uno de los ejemplos más representativos de esta fricción operativa ocurre en la gestión de cuentas por pagar, específicamente durante la recepción, verificación tributaria y causación contable de facturas electrónicas emitidas por proveedores.'
  );
  addParagraph(
    'Cuando dicho proceso se ejecuta manualmente, los analistas deben monitorear buzones de correo, descargar archivos XML y PDF, contrastar los montos facturados contra órdenes de compra aprobadas y digitar cada registro en el sistema de planificación de recursos empresariales (ERP). Este modo de operación introduce cuellos de botella en los cierres contables, incrementa la probabilidad de errores de digitación y expone a la entidad a causaciones duplicadas o a la pérdida de descuentos financieros por pronto pago.'
  );

  addSubHeading('1.2 Justificación general del proyecto');
  addParagraph(
    'La convergencia entre plataformas abiertas de orquestación Low-Code basada en flujos como Node-RED, la automatización robótica de procesos (RPA) y los modelos de inteligencia artificial aplicados al procesamiento documental ofrece un camino viable para modernizar flujos empresariales sin incurrir en reescrituras costosas de los sistemas centrales (van der Aalst et al., 2018; Davenport & Ronanki, 2018). No obstante, el ejercicio de la ingeniería de software exige trascender el entusiasmo instrumental: implementar una automatización sin controles de idempotencia, sin manejo explícito de fallos de red ni evaluación ética sobre el impacto organizacional puede amplificar errores a escala industrial. Por ello, resulta indispensable diseñar soluciones que articulen rigor arquitectónico, observabilidad y responsabilidad profesional.'
  );

  addSubHeading('1.3 Objetivos del trabajo');
  addParagraph(
    'El objetivo general del presente proyecto consiste en analizar, diseñar y validar un prototipo funcional de automatización para el proceso de recepción, validación fiscal y causación contable de facturas electrónicas mediante orquestación Low-Code (Node-RED), integración de servicios API, RPA e inteligencia artificial aplicada, evaluando de manera crítica su impacto técnico, organizacional y ético. Como objetivos específicos se establecen: (a) caracterizar el proceso empresarial actual (AS-IS) identificando entradas, salidas, actores, dependencias y puntos de dolor; (b) modelar el flujo objetivo (TO-BE) bajo notación estándar BPMN 2.0; (c) implementar y probar un prototipo con manejo de errores e idempotencia ante escenarios exitosos y de fallo controlado; y (d) formular estrategias de mitigación de riesgos y lineamientos éticos de implementación.'
  );

  // SECCIÓN 2: DESCRIPCIÓN DEL PROCESO SELECCIONADO
  addSectionHeading('2. Descripción del Proceso Seleccionado', true);
  addParagraph(
    'El proceso seleccionado corresponde a la gestión integral de cuentas por pagar desde la recepción de la factura electrónica del proveedor hasta su causación definitiva en el libro auxiliar del ERP y la notificación a Tesorería. Siguiendo los lineamientos metodológicos para la identificación de procesos automatizables en transformación digital (vom Brocke & Rosemann, 2015), este flujo presenta alto volumen transaccional, reglas de negocio explícitas y estructura documental estandarizable.'
  );

  addSubHeading('2.1 Entradas y salidas');
  addParagraph(
    'Las entradas principales del flujo comprenden: (a) el comprobante electrónico en formato XML (estándar UBL 2.1) acompañado de su representación gráfica en PDF o imagen enviada al buzón de correo; (b) la base maestra de órdenes de compra (OC) aprobadas con su respectivo centro de costo y cuenta contable asignada; y (c) los parámetros vigentes del registro tributario del emisor (NIT y Código Único de Factura Electrónica — CUFE). Como salidas resultantes se generan: (a) el asiento contable causado en el ERP con cálculo de retenciones aplicables y neto a pagar; (b) el aviso de confirmación hacia el área de Tesorería vía webhook y correo electrónico; o, en su defecto, (c) el aislamiento controlado del documento en cola de cuarentena acompañado de una alerta diagnóstica para revisión humana.'
  );

  addSubHeading('2.2 Actores involucrados');
  addParagraph(
    'En el ciclo operativo intervienen cuatro actores principales: el proveedor externo, responsable de emitir el documento tributario con referencia válida a la OC; el analista contable, encargado de conciliar los soportes y resolver excepciones en la cola Human-in-the-Loop (HITL); la gerencia financiera o de tesorería, encargada de autorizar desviaciones excepcionales y programar desembolsos; y el ecosistema tecnológico compuesto por el orquestador Node-RED, el servicio de validación tributaria, el motor de extracción documental y el sistema ERP corporativo.'
  );

  addSubHeading('2.3 Dependencias y puntos de decisión');
  addParagraph(
    'La ejecución válida del proceso depende de la disponibilidad de los servicios de consulta fiscal, la integridad sintáctica del archivo XML adjunto o la legibilidad del PDF, la existencia de una OC aprobada previamente y la conectividad con el módulo contable del ERP. Los puntos de decisión críticos son cuatro: verificar la autenticidad de la petición mediante firma HMAC-SHA256 cuando el canal es un webhook externo, confirmar que la confianza de extracción supere el umbral mínimo parametrizado, validar que el NIT emisor coincida con el titular de la OC con una desviación máxima del 5%, y comprobar mediante control de idempotencia que el número de factura no haya sido causado previamente.'
  );

  addSubHeading('2.4 Dolor actual en la operación manual');
  addParagraph(
    `Bajo el esquema manual actual (AS-IS), para un volumen operativo de ${roi.monthlyInvoices.toLocaleString(
      'es-CO'
    )} facturas mensuales, cada documento demanda en promedio ${
      roi.manualMinutesPerInvoice
    } minutos de atención continua, lo cual equivale a ${manualHoursMonth.toFixed(
      1
    )} horas-hombre al mes dedicadas a verificación y captura repetitiva. Adicionalmente, la tasa histórica de errores de digitación o conciliación se sitúa en ${
      roi.manualErrorRatePercent
    }%, generando reprocesos contables, retrasos en cierres mensuales y exposición a sanciones o pérdida de descuentos comerciales.`
  );

  // SECCIÓN 3: JUSTIFICACIÓN DE LA AUTOMATIZACIÓN
  addSectionHeading('3. Justificación de la Automatización', true);
  addParagraph(
    'Desde una perspectiva de ingeniería de procesos, la automatización se justifica cuando converge un volumen transaccional recurrente con reglas de verificación susceptibles de formalización lógica (Syed et al., 2020). En el caso analizado, el problema central no radica en la falta de capacidad del personal contable, sino en la asignación de criterio profesional a tareas mecánicas de cotejo documental que pueden ser ejecutadas de manera determinística por un orquestador digital.'
  );
  addParagraph(
    `La oportunidad de mejora se materializa al sustituir la digitación manual por un flujo híbrido orientado a eventos. Con base en los parámetros cuantitativos modelados en el estudio, la reducción del tiempo de procesamiento unitario desde ${
      roi.manualMinutesPerInvoice
    } minutos hasta ${
      roi.automatedMinutesPerInvoice
    } minutos por factura representa una disminución del ${timeReductionPct.toFixed(
      1
    )}% en el tiempo operativo de ciclo, liberando aproximadamente ${hoursSavedMonth.toFixed(
      1
    )} horas mensuales. Considerando el costo de hora analista de $${roi.analystHourlyCostCop.toLocaleString(
      'es-CO'
    )} COP y la disminución de costos por retrabajo (${Math.round(
      reworkSavingsMonth
    ).toLocaleString(
      'es-CO'
    )} COP/mes en reprocesos evitados), el ahorro operativo anual proyectado asciende a $${Math.round(
      annualSavingsCop
    ).toLocaleString('es-CO')} COP.`
  );
  addParagraph(
    'En cuanto al alcance del prototipo funcional, se delimitó un Producto Mínimo Viable (MVP) que abarca desde la recepción multicanal de la factura (archivo PDF/imagen/XML, buzón de Gmail o webhook HTTP firmado) hasta su causación en el libro auxiliar del ERP o su derivación hacia la cola de cuarentena. Quedan fuera del alcance automatizado las aprobaciones gerenciales de sobrecostos superiores al 5%, las cuales requieren explícitamente la intervención y firma de un responsable financiero humano.'
  );

  // SECCIÓN 4: MARCO TECNOLÓGICO
  addSectionHeading('4. Marco Tecnológico', true);
  addParagraph(
    'La selección tecnológica del proyecto responde a un enfoque arquitectónico por capas que evita depender de una única herramienta monolítica. Tal como advierten van der Aalst et al. (2018), el uso indiscriminado de robots de interfaz gráfica (RPA tradicional) sobre sistemas que ya disponen de interfaces de programación (API) genera soluciones frágiles ante cambios visuales mínimos. En consecuencia, se adopta una arquitectura API-first complementada selectivamente por RPA e inteligencia artificial aplicada.'
  );

  addApaTable(
    'Tabla 1',
    'Comparativa y justificación de la arquitectura tecnológica seleccionada',
    ['Capa', 'Tecnología', 'Rol operativo', 'Sustento técnico'],
    TECHNOLOGY_COMPARISON.map((item) => [
      item.dimension,
      item.technology,
      item.role,
      item.justification,
    ]),
    {
      0: { cellWidth: 85 },
      1: { cellWidth: 105 },
      2: { cellWidth: 115 },
      3: { cellWidth: 163 },
    }
  );

  addParagraph(
    'En primer lugar, Node-RED actúa como plataforma Low-Code de orquestación central basada en programación orientada a flujos (Flow-Based Programming), gracias a su modelo de ejecución dirigido por eventos, sus nodos nativos HTTP In/Request, bifurcaciones Switch, manejo explícito de errores mediante nodos Catch y licencia abierta Apache 2.0 (OpenJS Foundation, 2025). En segundo lugar, el componente de inteligencia artificial se circunscribe al reconocimiento óptico de caracteres (OCR) y a la clasificación semántica de conceptos de gasto para sugerir cuentas contables (Davenport & Ronanki, 2018), manteniendo reglas determinísticas para toda validación matemática y tributaria.'
  );

  // SECCIÓN 5: DISEÑO DEL PROTOTIPO
  addSectionHeading('5. Diseño del Prototipo', true);
  addSubHeading('5.1 Diagrama de flujo del proceso (BPMN 2.0)');
  addParagraph(
    'La Figura 1 ilustra la modelación formal del proceso automatizado bajo la especificación BPMN 2.0, organizada en cuatro carriles funcionales (swimlanes): Proveedor, Orquestador Node-RED, Servicio de IA y API Fiscal, y ERP y Tesorería. Se incorpora un evento intermedio de borde para capturar errores de disponibilidad o rechazo tributario sin interrumpir el procesamiento de facturas posteriores.'
  );

  const bpmnPng = await svgElementToPngDataUrl(bpmnSvgElement);
  if (bpmnPng) {
    await addFigureFromImage(
      'Figura 1',
      'Diagrama de proceso BPMN 2.0 con carriles funcionales y manejo de excepciones',
      'Nota. Elaboración propia a partir del análisis de flujo TO-BE del proyecto.',
      bpmnPng.dataUrl,
      bpmnPng.width,
      bpmnPng.height,
      'PNG'
    );
  }

  addSubHeading('5.2 Descripción técnica del funcionamiento por nodos');
  addParagraph(
    'El prototipo implementado en arquitectura Node-RED y respaldado por servicios REST reales en Node.js/Express se estructura en siete nodos interconectados (Tabla 2). Cada etapa aplica controles de validación de esquema, verificación criptográfica HMAC-SHA256 en webhooks entrantes, políticas de reintento exponencial frente a indisponibilidad transitoria (código HTTP 503) e idempotencia mediante verificación previa de duplicidad en el libro mayor del ERP (código HTTP 409).'
  );

  addApaTable(
    'Tabla 2',
    'Especificación técnica de los nodos implementados en el prototipo Node-RED',
    ['Nodo', 'Tipo técnico Node-RED', 'Manejo de errores', 'Función dentro del flujo'],
    WORKFLOW_NODES.map((node) => [
      node.title,
      node.n8nNodeType,
      node.retryPolicy,
      node.description,
    ]),
    {
      0: { cellWidth: 105 },
      1: { cellWidth: 95 },
      2: { cellWidth: 115 },
      3: { cellWidth: 153 },
    }
  );

  // SECCIÓN 6: EVIDENCIAS TÉCNICAS
  addSectionHeading('6. Evidencias Técnicas y Registro de Pruebas', true);
  addParagraph(
    'Para verificar la validez funcional y la resiliencia del prototipo, se ejecutaron pruebas controladas contra los endpoints REST del entorno de simulación empresarial y la integración real con Gmail API. De conformidad con los requisitos de verificación de software, la Tabla 3 documenta los resultados obtenidos tanto en un escenario nominal exitoso como en un escenario de error controlado con activación de la ruta alterna de cuarentena financiera.'
  );

  addApaTable(
    'Tabla 3',
    'Registro de ejecuciones de prueba del prototipo funcional (escenarios exitoso y error controlado)',
    ['ID', 'Escenario evaluado', 'Factura', 'Monto (COP)', 'Latencia', 'Resultado'],
    logs.slice(0, 6).map((log) => [
      log.id,
      log.scenarioLabel,
      log.invoiceNumber,
      `$${log.amount.toLocaleString('es-CO')}`,
      `${log.totalDurationMs} ms`,
      log.finalOutcome,
    ]),
    {
      0: { cellWidth: 68 },
      1: { cellWidth: 138 },
      2: { cellWidth: 72 },
      3: { cellWidth: 65, halign: 'right' },
      4: { cellWidth: 48, halign: 'right' },
      5: { cellWidth: 77 },
    }
  );

  if (successLog) {
    addSubHeading(`Evidencia A: Traza de ejecución exitosa (${successLog.id} — ${successLog.invoiceNumber})`);
    for (let i = 0; i < successLog.steps.length; i += 1) {
      const s = successLog.steps[i];
      addParagraph(
        `${i + 1}. ${s.nodeName} (${s.durationMs} ms${s.httpStatus ? `, HTTP ${s.httpStatus}` : ''}): ${s.summary}`,
        false
      );
    }
  }

  if (errorLog) {
    addSubHeading(`Evidencia B: Traza de error controlado (${errorLog.id} — ${errorLog.invoiceNumber})`);
    for (let i = 0; i < errorLog.steps.length; i += 1) {
      const s = errorLog.steps[i];
      addParagraph(
        `${i + 1}. ${s.nodeName} (${s.durationMs} ms${s.httpStatus ? `, HTTP ${s.httpStatus}` : ''}): ${s.summary}`,
        false
      );
    }
  }

  let nextFigureNumber = 2;
  if (screenshots.nodeRedDataUrl) {
    const dims = await getImageDimensions(screenshots.nodeRedDataUrl);
    if (dims) {
      await addFigureFromImage(
        `Figura ${nextFigureNumber}`,
        'Captura de ejecución real del flujo orquestado en Node-RED',
        'Nota. Captura de pantalla tomada del entorno operativo Node-RED durante las pruebas funcionales.',
        screenshots.nodeRedDataUrl,
        dims.width,
        dims.height,
        dims.format
      );
      nextFigureNumber += 1;
    }
  }

  if (screenshots.gmailDataUrl) {
    const dims = await getImageDimensions(screenshots.gmailDataUrl);
    if (dims) {
      await addFigureFromImage(
        `Figura ${nextFigureNumber}`,
        'Evidencia de notificación automatizada entregada mediante Gmail API',
        'Nota. Correo electrónico real generado por el flujo al finalizar la validación contable.',
        screenshots.gmailDataUrl,
        dims.width,
        dims.height,
        dims.format
      );
    }
  }

  // SECCIÓN 7: EVALUACIÓN CRÍTICA
  addSectionHeading('7. Evaluación Crítica', true);
  addSubHeading('7.1 Beneficios esperados y desafíos técnicos u organizacionales');
  addParagraph(
    `La automatización del ciclo de cuentas por pagar aporta beneficios directos en eficiencia operativa, trazabilidad de auditoría y reducción de errores humanos. La ejecución estandarizada garantiza que cada factura causada cuente con respaldo tributario verificado y cálculo exacto de retenciones, reduciendo el tiempo de procesamiento en un ${timeReductionPct.toFixed(
      1
    )}%. No obstante, emergen desafíos relevantes: en el plano técnico, la heterogeneidad de formatos PDF enviados por pequeños proveedores y los cambios eventuales en los esquemas de APIs tributarias exigen monitoreo continuo; en el plano organizacional, la resistencia al cambio de los equipos contables puede obstaculizar la adopción si la solución se percibe como un mecanismo de vigilancia o desplazamiento laboral.`
  );

  addSubHeading('7.2 Matriz de riesgos potenciales y estrategias de mitigación');
  addParagraph(
    'Siguiendo los principios de gestión de seguridad de la información establecidos en la norma ISO/IEC 27001:2022 (International Organization for Standardization, 2022), se identificaron cuatro vectores de riesgo críticos con sus respectivas salvaguardas arquitectónicas (Tabla 4).'
  );

  addApaTable(
    'Tabla 4',
    'Evaluación de riesgos técnicos y estrategias de mitigación',
    ['Categoría', 'Riesgo identificado', 'Nivel', 'Estrategia de mitigación'],
    RISK_MATRIX.map((r) => [
      r.category,
      r.risk,
      `${r.impact} (${r.likelihood})`,
      r.mitigation,
    ]),
    {
      0: { cellWidth: 95 },
      1: { cellWidth: 125 },
      2: { cellWidth: 75 },
      3: { cellWidth: 173 },
    }
  );

  addSubHeading('7.3 Consideraciones éticas y responsabilidad profesional');
  addParagraph(
    'El despliegue de sistemas automatizados asistidos por inteligencia artificial conlleva responsabilidades éticas ineludibles para el ingeniero de software (IEEE Global Initiative on Ethics of Autonomous and Intelligent Systems, 2019). En primer lugar, respecto al impacto laboral, la automatización debe orientarse a la liberación cognitiva (reconversión de auxiliares hacia análisis financiero, gestión de relaciones con proveedores y control presupuestal) y no a la supresión acrítica de puestos de trabajo sin planes de transición y capacitación.'
  );
  addParagraph(
    'En segundo lugar, la arquitectura adopta el principio de transparencia y supervisión humana (Human-in-the-Loop): ningún modelo probabilístico está autorizado para aprobar pagos de forma autónoma fuera de las reglas determinísticas de la orden de compra. Toda decisión automatizada queda registrada en bitácoras auditables con marca temporal, carga útil y justificación técnica, asegurando la rendición de cuentas (accountability) y la protección de datos empresariales y personales contenidos en los documentos fiscales.'
  );

  // SECCIÓN 8: CONCLUSIONES Y RECOMENDACIONES
  addSectionHeading('8. Conclusiones y Recomendaciones', true);
  addParagraph(
    'El desarrollo del prototipo demuestra que la combinación de orquestación Low-Code mediante Node-RED, servicios REST desacoplados y extracción asistida por IA constituye una estrategia sólida para automatizar procesos administrativos de alto volumen como cuentas por pagar. Las pruebas ejecutadas validan tanto la eficiencia del camino nominal como la capacidad de la arquitectura para contener errores transitorios (HTTP 503 mediante reintentos exponenciales) y discrepancias de negocio (HTTP 422 mediante aislamiento en cuarentena), evitando causaciones indebidas o duplicadas (HTTP 409).'
  );
  addParagraph(
    'Desde el punto de vista organizacional y ético, se concluye que el éxito sostenible de una iniciativa de transformación digital depende de mantener al ser humano como autoridad final sobre las excepciones críticas y de acompañar la implementación técnica con programas de recapacitación del talento contable. Como recomendaciones operativas consolidadas se destacan la verificación de firma criptográfica HMAC-SHA256 en el webhook de recepción, el seguimiento mediante tableros de observabilidad sobre tasas de confianza del OCR para detectar deriva documental, y la ejecución de auditorías periódicas sobre las bitácoras de ejecución para garantizar cumplimiento continuo bajo estándares ISO/IEC 27001.'
  );

  // SECCIÓN 9: REFERENCIAS (APA 7.ª ED.)
  addSectionHeading('Referencias', true);
  for (const ref of APA_REFERENCES) {
    addHangingReference(ref.citation);
  }

  // Stamp APA 7th Ed. top-right page numbers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(String(p), PAGE_WIDTH - MARGIN, 44, { align: 'right' });
  }

  const fileName = 'Informe_APA_Custodios_Innovacion.pdf';
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  return {
    fileName,
    totalPages,
    bodyPages: Math.max(1, totalPages - 2),
  };
}
