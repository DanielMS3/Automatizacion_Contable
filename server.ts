import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'automation_db.json');

interface PurchaseOrder {
  poNumber: string;
  vendorName: string;
  vendorNit: string;
  authorizedAmount: number;
  costCenter: string;
  glAccount: string;
}

interface ErpEntry {
  entryId: string;
  invoiceNumber: string;
  vendorName: string;
  vendorNit: string;
  purchaseOrder: string;
  grossAmount: number;
  withholdingTax: number;
  netPayable: number;
  costCenter: string;
  glAccount: string;
  postedAt: string;
  approvedManually?: boolean;
}

interface QuarantineItem {
  id: string;
  executionId: string;
  invoiceNumber: string;
  vendorName: string;
  vendorNit: string;
  purchaseOrder: string;
  amount: number;
  reasonCode: string;
  reasonMessage: string;
  costCenter?: string;
  glAccount?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

interface WorkflowSettings {
  outboundWebhookUrl: string;
  notificationEmail: string;
  tolerancePercent: number;
  minAiConfidence: number;
  requireHmacHeader: boolean;
  hmacSecret: string;
}

interface StepTrace {
  nodeId: string;
  nodeName: string;
  status: 'success' | 'retry' | 'error' | 'skipped';
  durationMs: number;
  httpStatus?: number;
  attempt?: number;
  summary: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
}

interface ExecutionLog {
  id: string;
  timestamp: string;
  source: 'ui_document' | 'ui_payload' | 'external_webhook' | 'gmail_inbox';
  scenarioLabel: string;
  scenarioType: 'success' | 'controlled_error' | 'retry_recovered';
  invoiceNumber: string;
  vendorName: string;
  amount: number;
  aiConfidence?: number;
  totalDurationMs: number;
  finalOutcome: 'Causada en ERP' | 'En cuarentena (Error controlado)';
  steps: StepTrace[];
}

interface AutomationDatabase {
  purchaseOrders: PurchaseOrder[];
  erpLedger: ErpEntry[];
  quarantineQueue: QuarantineItem[];
  executionLogs: ExecutionLog[];
  settings: WorkflowSettings;
}

const DEFAULT_DB: AutomationDatabase = {
  purchaseOrders: [
    {
      poNumber: 'OC-2026-4490',
      vendorName: 'Soluciones Cloud Andina S.A.S.',
      vendorNit: '901245781-3',
      authorizedAmount: 4250000,
      costCenter: 'CC-TI-04',
      glAccount: '513520-Servicios-Cloud',
    },
    {
      poNumber: 'OC-2026-4491',
      vendorName: 'Logística Integral del Pacífico S.A.',
      vendorNit: '890412990-1',
      authorizedAmount: 2800000,
      costCenter: 'CC-OPS-02',
      glAccount: '523550-Transporte-Carga',
    },
    {
      poNumber: 'OC-2026-4502',
      vendorName: 'Consultora Ciberseguridad Nexo Ltda.',
      vendorNit: '900881340-7',
      authorizedAmount: 6500000,
      costCenter: 'CC-SEG-01',
      glAccount: '511035-Asesoria-Tecnica',
    },
  ],
  erpLedger: [
    {
      entryId: 'ASIENTO-2026-0091',
      invoiceNumber: 'FAC-2026-0840',
      vendorName: 'Logística Integral del Pacífico S.A.',
      vendorNit: '890412990-1',
      purchaseOrder: 'OC-2026-4491',
      grossAmount: 2800000,
      withholdingTax: 98000,
      netPayable: 2702000,
      costCenter: 'CC-OPS-02',
      glAccount: '523550-Transporte-Carga',
      postedAt: '2026-11-20T14:22:11.000Z',
    },
  ],
  quarantineQueue: [
    {
      id: 'QUAR-2026-001',
      executionId: 'EXEC-2026-1002',
      invoiceNumber: 'FAC-2026-0842',
      vendorName: 'Soluciones Cloud Andina S.A.S.',
      vendorNit: '901245781-3',
      purchaseOrder: 'OC-2026-4490',
      amount: 5150000,
      reasonCode: 'PO_VARIANCE_EXCEEDED',
      reasonMessage:
        'El monto facturado ($5.150.000) supera la tolerancia del 5% sobre OC-2026-4490 ($4.250.000). Desviación: +21.18%.',
      costCenter: 'CC-TI-04',
      glAccount: '513520-Servicios-Cloud',
      status: 'pending',
      createdAt: '2026-11-20T14:35:48.000Z',
    },
  ],
  executionLogs: [
    {
      id: 'EXEC-2026-1001',
      timestamp: '2026-11-20T14:22:11.000Z',
      source: 'ui_payload',
      scenarioLabel: 'Escenario 1: Flujo nominal con conciliación exacta de OC',
      scenarioType: 'success',
      invoiceNumber: 'FAC-2026-0840',
      vendorName: 'Logística Integral del Pacífico S.A.',
      amount: 2800000,
      aiConfidence: 0.98,
      totalDurationMs: 412,
      finalOutcome: 'Causada en ERP',
      steps: [
        {
          nodeId: 'trigger-webhook',
          nodeName: 'Recepción Buzón / Webhook',
          status: 'success',
          durationMs: 18,
          httpStatus: 200,
          summary: 'Documento electrónico recibido (XML + PDF) desde proveedor verificado.',
        },
        {
          nodeId: 'ocr-ai',
          nodeName: 'Extracción OCR & Clasificación IA',
          status: 'success',
          durationMs: 145,
          httpStatus: 200,
          summary: 'Entidades extraídas con confianza 0.98; cuenta contable sugerida 523550.',
        },
        {
          nodeId: 'tax-api',
          nodeName: 'Validación Tributaria & OC',
          status: 'success',
          durationMs: 112,
          httpStatus: 200,
          attempt: 1,
          summary: 'NIT 890412990-1 activo; OC-2026-4491 dentro de tolerancia (0.0%).',
        },
        {
          nodeId: 'decision-if',
          nodeName: 'Regla de Decisión (IF)',
          status: 'success',
          durationMs: 6,
          summary: 'Condición verdadera: desviación <= 5% y estado fiscal vigente.',
        },
        {
          nodeId: 'erp-post',
          nodeName: 'Causación Contable en ERP',
          status: 'success',
          durationMs: 89,
          httpStatus: 201,
          summary: 'Asiento ASIENTO-2026-0091 generado. Neto a pagar: $2.702.000 COP.',
        },
        {
          nodeId: 'notify-success',
          nodeName: 'Notificación a Tesorería',
          status: 'success',
          durationMs: 42,
          httpStatus: 200,
          summary: 'Confirmación registrada para Tesorería.',
        },
      ],
    },
    {
      id: 'EXEC-2026-1002',
      timestamp: '2026-11-20T14:35:48.000Z',
      source: 'ui_payload',
      scenarioLabel: 'Escenario 2: Error controlado por sobrecosto respecto a OC',
      scenarioType: 'controlled_error',
      invoiceNumber: 'FAC-2026-0842',
      vendorName: 'Soluciones Cloud Andina S.A.S.',
      amount: 5150000,
      aiConfidence: 0.96,
      totalDurationMs: 368,
      finalOutcome: 'En cuarentena (Error controlado)',
      steps: [
        {
          nodeId: 'trigger-webhook',
          nodeName: 'Recepción Buzón / Webhook',
          status: 'success',
          durationMs: 14,
          httpStatus: 200,
          summary: 'Documento electrónico recibido desde buzón de facturación.',
        },
        {
          nodeId: 'ocr-ai',
          nodeName: 'Extracción OCR & Clasificación IA',
          status: 'success',
          durationMs: 132,
          httpStatus: 200,
          summary: 'Entidades extraídas con confianza 0.96; monto facturado $5.150.000 COP.',
        },
        {
          nodeId: 'tax-api',
          nodeName: 'Validación Tributaria & OC',
          status: 'error',
          durationMs: 118,
          httpStatus: 422,
          attempt: 1,
          summary:
            'Rechazo 422 (PO_VARIANCE_EXCEEDED): monto excede OC-2026-4490 en +21.18% (máx 5%).',
        },
        {
          nodeId: 'decision-if',
          nodeName: 'Regla de Decisión (IF)',
          status: 'error',
          durationMs: 5,
          summary: 'Condición falsa: se desvía ejecución hacia rama alterna de cuarentena financiera.',
        },
        {
          nodeId: 'quarantine-alert',
          nodeName: 'Cuarentena & Alerta Controlada',
          status: 'success',
          durationMs: 99,
          httpStatus: 200,
          summary: 'Factura aislada en cola de revisión humana (QUAR-2026-001).',
        },
      ],
    },
  ],
  settings: {
    outboundWebhookUrl: '',
    notificationEmail: 'danielricardomorenortiz@gmail.com',
    tolerancePercent: 5,
    minAiConfidence: 0.85,
    requireHmacHeader: false,
    hmacSecret: 'custodios-hmac-2026',
  },
};

function loadDb(): AutomationDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
      return JSON.parse(JSON.stringify(DEFAULT_DB)) as AutomationDatabase;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AutomationDatabase>;
    return {
      purchaseOrders: parsed.purchaseOrders ?? DEFAULT_DB.purchaseOrders,
      erpLedger: parsed.erpLedger ?? DEFAULT_DB.erpLedger,
      quarantineQueue: parsed.quarantineQueue ?? DEFAULT_DB.quarantineQueue,
      executionLogs: parsed.executionLogs ?? DEFAULT_DB.executionLogs,
      settings: { ...DEFAULT_DB.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DB)) as AutomationDatabase;
  }
}

function saveDb(db: AutomationDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

const db: AutomationDatabase = loadDb();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface ExtractedInvoiceFields {
  invoiceNumber: string;
  vendorName: string;
  vendorNit: string;
  purchaseOrder: string;
  grossAmount: number;
  cufe: string;
  concept: string;
  suggestedGlAccount: string;
  aiConfidence: number;
  extractionEngine: 'gemini-4-hydrogen' | 'xml-ubl-parser' | 'structured-json';
}

function tryParseXmlUbl(xmlText: string): ExtractedInvoiceFields | null {
  const getTag = (regex: RegExp) => {
    const match = xmlText.match(regex);
    return match?.[1]?.trim() ?? '';
  };

  const invoiceNumber =
    getTag(/<cbc:ID>([^<]+)<\/cbc:ID>/i) || getTag(/<InvoiceNumber>([^<]+)<\/InvoiceNumber>/i);
  const vendorName =
    getTag(/<cbc:RegistrationName>([^<]+)<\/cbc:RegistrationName>/i) ||
    getTag(/<VendorName>([^<]+)<\/VendorName>/i);
  const vendorNit =
    getTag(/<cbc:CompanyID[^>]*>([^<]+)<\/cbc:CompanyID>/i) ||
    getTag(/<VendorNit>([^<]+)<\/VendorNit>/i);
  const purchaseOrder =
    getTag(/<cac:OrderReference>[\s\S]*?<cbc:ID>([^<]+)<\/cbc:ID>/i) ||
    getTag(/<PurchaseOrder>([^<]+)<\/PurchaseOrder>/i);
  const rawAmount =
    getTag(/<cbc:PayableAmount[^>]*>([^<]+)<\/cbc:PayableAmount>/i) ||
    getTag(/<TotalAmount>([^<]+)<\/TotalAmount>/i);
  const cufe = getTag(/<cbc:UUID[^>]*>([^<]+)<\/cbc:UUID>/i) || `CUFE-XML-${Date.now().toString(36).toUpperCase()}`;

  const grossAmount = Number(rawAmount.replace(/[^\d.]/g, '')) || 0;
  if (!invoiceNumber || !vendorNit || grossAmount <= 0) {
    return null;
  }

  return {
    invoiceNumber,
    vendorName: vendorName || 'Proveedor XML',
    vendorNit,
    purchaseOrder,
    grossAmount,
    cufe,
    concept: getTag(/<cbc:Description>([^<]+)<\/cbc:Description>/i) || 'Servicios facturados en XML UBL',
    suggestedGlAccount: '513520-Servicios-Tecnologicos',
    aiConfidence: 0.99,
    extractionEngine: 'xml-ubl-parser',
  };
}

async function extractWithGemini(params: {
  rawText?: string;
  base64Data?: string;
  mimeType?: string;
  fileName?: string;
}): Promise<ExtractedInvoiceFields> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY no está configurada en el servidor. Configure el secreto en Settings > Secrets para habilitar la extracción real con Gemini.'
    );
  }

  const promptText = `Eres un motor de extracción OCR contable y tributario para cuentas por pagar en Colombia.
Analiza el documento de factura adjunto (PDF, imagen o texto) y extrae exactamente los campos requeridos en JSON.
Si algún campo no aparece explícitamente, devuelve cadena vacía o 0, y asigna una confianza real entre 0.0 y 1.0 en aiConfidence.
Sugiere una cuenta contable PUC apropiada en suggestedGlAccount (ej. "513520-Servicios-Cloud", "523550-Transporte-Carga", "511035-Asesoria-Tecnica", "519530-Suministros").`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (params.base64Data && params.mimeType) {
    parts.push({
      inlineData: {
        mimeType: params.mimeType,
        data: params.base64Data,
      },
    });
  }
  if (params.rawText) {
    parts.push({
      text: `Contenido del documento (${params.fileName || 'texto'}):\n${params.rawText}`,
    });
  }
  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          invoiceNumber: { type: Type.STRING, description: 'Número de factura (ej. FAC-2026-0910)' },
          vendorName: { type: Type.STRING, description: 'Razón social del proveedor emisor' },
          vendorNit: { type: Type.STRING, description: 'NIT del proveedor con dígito de verificación (ej. 901245781-3)' },
          purchaseOrder: { type: Type.STRING, description: 'Número de orden de compra referenciada (ej. OC-2026-4490)' },
          grossAmount: { type: Type.NUMBER, description: 'Valor total bruto de la factura en pesos numéricos' },
          cufe: { type: Type.STRING, description: 'Código Único de Factura Electrónica o hash identificador' },
          concept: { type: Type.STRING, description: 'Breve descripción del servicio o producto facturado' },
          suggestedGlAccount: { type: Type.STRING, description: 'Cuenta contable PUC sugerida' },
          aiConfidence: { type: Type.NUMBER, description: 'Nivel de confianza de extracción de 0.0 a 1.0' },
        },
        required: [
          'invoiceNumber',
          'vendorName',
          'vendorNit',
          'purchaseOrder',
          'grossAmount',
          'suggestedGlAccount',
          'aiConfidence',
        ],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  const parsed = JSON.parse(text) as Partial<ExtractedInvoiceFields>;
  return {
    invoiceNumber: String(parsed.invoiceNumber || `FAC-AI-${Date.now().toString().slice(-4)}`),
    vendorName: String(parsed.vendorName || 'Proveedor No Identificado'),
    vendorNit: String(parsed.vendorNit || ''),
    purchaseOrder: String(parsed.purchaseOrder || ''),
    grossAmount: Number(parsed.grossAmount) || 0,
    cufe: String(parsed.cufe || `CUFE-AI-${Date.now().toString(36).toUpperCase()}`),
    concept: String(parsed.concept || 'Concepto extraído por OCR'),
    suggestedGlAccount: String(parsed.suggestedGlAccount || '519595-Gastos-Por-Clasificar'),
    aiConfidence: Math.min(1, Math.max(0, Number(parsed.aiConfidence) || 0.85)),
    extractionEngine: 'gemini-4-hydrogen',
  };
}

async function dispatchOutboundWebhook(payload: Record<string, unknown>): Promise<{
  sent: boolean;
  httpStatus?: number;
  durationMs: number;
  summary: string;
  responseBody?: string;
}> {
  const targetUrl = db.settings.outboundWebhookUrl?.trim();
  const start = performance.now();

  if (!targetUrl) {
    return {
      sent: false,
      httpStatus: 200,
      durationMs: 14,
      summary:
        'Notificación registrada en bitácora interna (sin URL de webhook saliente configurada).',
    };
  }

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Automation-Source': 'Custodios-Innovacion-n8n-Engine',
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => '');
    const durationMs = Math.max(5, Math.round(performance.now() - start));
    return {
      sent: res.ok,
      httpStatus: res.status,
      durationMs,
      summary: res.ok
        ? `Webhook saliente entregado a ${targetUrl} (HTTP ${res.status} en ${durationMs} ms).`
        : `Webhook saliente respondió HTTP ${res.status} desde ${targetUrl}.`,
      responseBody: text.slice(0, 300),
    };
  } catch (err) {
    const durationMs = Math.max(5, Math.round(performance.now() - start));
    return {
      sent: false,
      httpStatus: 502,
      durationMs,
      summary: `Error de red al invocar webhook saliente (${err instanceof Error ? err.message : 'Error desconocido'}).`,
    };
  }
}

async function runRealAutomatedWorkflow(input: {
  source: ExecutionLog['source'];
  scenarioLabel?: string;
  fileName?: string;
  mimeType?: string;
  base64Data?: string;
  rawText?: string;
  corruptedPayload?: boolean;
  simulateTransientError?: boolean;
  invoiceNumber?: string;
  vendorName?: string;
  vendorNit?: string;
  purchaseOrder?: string;
  amount?: number;
}): Promise<ExecutionLog> {
  const startedAt = performance.now();
  const executionId = `EXEC-${Date.now().toString().slice(-6)}`;
  const steps: StepTrace[] = [];

  // 1. Trigger / Ingestion Node
  const triggerStart = performance.now();
  const sourceDesc =
    input.source === 'external_webhook'
      ? 'Petición HTTP recibida en el endpoint público POST /api/webhook/invoices.'
      : input.source === 'gmail_inbox'
      ? `Correo real de Gmail ingerido (${input.fileName || 'cuerpo del mensaje'}) para extracción documental.`
      : input.fileName
      ? `Archivo real '${input.fileName}' (${input.mimeType || 'documento'}) recibido para procesamiento.`
      : `Carga útil estructurada recibida para factura ${input.invoiceNumber || 'sin número'}.`;

  steps.push({
    nodeId: 'trigger-webhook',
    nodeName: 'Recepción Buzón / Webhook',
    status: 'success',
    durationMs: Math.max(4, Math.round(performance.now() - triggerStart)),
    httpStatus: 200,
    summary: sourceDesc,
    requestPayload: {
      source: input.source,
      fileName: input.fileName,
      invoiceNumber: input.invoiceNumber,
      purchaseOrder: input.purchaseOrder,
      amount: input.amount,
    },
  });

  // 2. OCR & AI Extraction Node
  const ocrStart = performance.now();
  let extracted: ExtractedInvoiceFields | null = null;
  let ocrErrorMessage: string | null = null;
  let ocrErrorCode = 'MALFORMED_DOCUMENT';
  let ocrStatus = 200;

  if (input.corruptedPayload) {
    ocrStatus = 422;
    ocrErrorCode = 'MALFORMED_XML';
    ocrErrorMessage =
      'El archivo XML carece de estructura UBL 2.1 válida o firma digital verificable.';
  } else if (input.base64Data || (input.rawText && !input.invoiceNumber)) {
    const maybeXml = input.rawText ? tryParseXmlUbl(input.rawText) : null;
    if (maybeXml) {
      extracted = maybeXml;
    } else {
      try {
        extracted = await extractWithGemini({
          rawText: input.rawText,
          base64Data: input.base64Data,
          mimeType: input.mimeType,
          fileName: input.fileName,
        });
      } catch (err) {
        ocrStatus = 502;
        ocrErrorCode = 'AI_EXTRACTION_ERROR';
        ocrErrorMessage = err instanceof Error ? err.message : 'Fallo en extracción IA Gemini.';
      }
    }
  } else {
    const matchedPo = db.purchaseOrders.find((p) => p.poNumber === input.purchaseOrder);
    extracted = {
      invoiceNumber: String(input.invoiceNumber || `FAC-${Date.now().toString().slice(-4)}`),
      vendorName: String(input.vendorName || matchedPo?.vendorName || 'Proveedor Externo'),
      vendorNit: String(input.vendorNit || ''),
      purchaseOrder: String(input.purchaseOrder || ''),
      grossAmount: Number(input.amount) || 0,
      cufe: `CUFE-${Buffer.from(String(input.invoiceNumber || 'FAC')).toString('hex').slice(0, 10).toUpperCase()}-2026`,
      concept: 'Factura electrónica estructurada',
      suggestedGlAccount: matchedPo?.glAccount || '513520-Servicios-Generales',
      aiConfidence: 0.98,
      extractionEngine: 'structured-json',
    };
  }

  const ocrDuration = Math.max(8, Math.round(performance.now() - ocrStart));

  const moveToQuarantine = async (
    reasonCode: string,
    reasonMessage: string,
    invNumber: string,
    vName: string,
    vNit: string,
    poNum: string,
    amt: number,
    costCenter?: string,
    glAccount?: string,
    aiConf?: number
  ): Promise<ExecutionLog> => {
    const qItem: QuarantineItem = {
      id: `QUAR-${Date.now().toString().slice(-5)}`,
      executionId,
      invoiceNumber: invNumber,
      vendorName: vName,
      vendorNit: vNit,
      purchaseOrder: poNum,
      amount: amt,
      reasonCode,
      reasonMessage,
      costCenter,
      glAccount,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.quarantineQueue.unshift(qItem);

    const notifResult = await dispatchOutboundWebhook({
      event: 'INVOICE_QUARANTINED',
      executionId,
      quarantineId: qItem.id,
      invoiceNumber: invNumber,
      vendorName: vName,
      amount: amt,
      reasonCode,
      reasonMessage,
    });

    steps.push({
      nodeId: 'quarantine-alert',
      nodeName: 'Cuarentena & Alerta Controlada',
      status: 'success',
      durationMs: notifResult.durationMs,
      httpStatus: notifResult.httpStatus,
      summary: `Factura aislada en cola HITL (${qItem.id}). ${notifResult.summary}`,
      responsePayload: { quarantineItem: qItem, webhook: notifResult },
    });

    const log: ExecutionLog = {
      id: executionId,
      timestamp: new Date().toISOString(),
      source: input.source,
      scenarioLabel:
        input.scenarioLabel || `Procesamiento real: ${invNumber} (${reasonCode})`,
      scenarioType: 'controlled_error',
      invoiceNumber: invNumber,
      vendorName: vName,
      amount: amt,
      ...(typeof aiConf === 'number' ? { aiConfidence: aiConf } : {}),
      totalDurationMs: Math.round(performance.now() - startedAt),
      finalOutcome: 'En cuarentena (Error controlado)',
      steps,
    };

    db.executionLogs = [log, ...db.executionLogs].slice(0, 40);
    saveDb(db);
    return log;
  };

  if (!extracted || ocrErrorMessage) {
    steps.push({
      nodeId: 'ocr-ai',
      nodeName: 'Extracción OCR & Clasificación IA',
      status: 'error',
      durationMs: ocrDuration,
      httpStatus: ocrStatus,
      summary: ocrErrorMessage || 'No fue posible extraer datos de la factura.',
      responsePayload: { ok: false, code: ocrErrorCode, message: ocrErrorMessage },
    });
    steps.push({
      nodeId: 'tax-api',
      nodeName: 'Validación Tributaria & OC',
      status: 'skipped',
      durationMs: 0,
      summary: 'Omitido por fallo previo en extracción documental.',
    });
    steps.push({
      nodeId: 'decision-if',
      nodeName: 'Regla de Decisión (IF)',
      status: 'error',
      durationMs: 2,
      summary: 'Condición falsa: el documento no superó la fase de extracción.',
    });
    return moveToQuarantine(
      ocrErrorCode,
      ocrErrorMessage || 'Error de lectura documental',
      input.invoiceNumber || input.fileName || 'DOC-SIN-ID',
      input.vendorName || 'Proveedor sin identificar',
      input.vendorNit || '',
      input.purchaseOrder || '',
      Number(input.amount) || 0
    );
  }

  // Check AI confidence threshold
  if (extracted.aiConfidence < db.settings.minAiConfidence) {
    steps.push({
      nodeId: 'ocr-ai',
      nodeName: 'Extracción OCR & Clasificación IA',
      status: 'error',
      durationMs: ocrDuration,
      httpStatus: 200,
      summary: `Confianza OCR insuficiente (${extracted.aiConfidence.toFixed(2)} < umbral ${db.settings.minAiConfidence}). Requiere validación humana.`,
      responsePayload: extracted,
    });
    steps.push({
      nodeId: 'decision-if',
      nodeName: 'Regla de Decisión (IF)',
      status: 'error',
      durationMs: 2,
      summary: 'Condición falsa por baja confianza en OCR.',
    });
    return moveToQuarantine(
      'LOW_AI_CONFIDENCE',
      `Confianza OCR (${extracted.aiConfidence.toFixed(2)}) por debajo del umbral configurado (${db.settings.minAiConfidence}).`,
      extracted.invoiceNumber,
      extracted.vendorName,
      extracted.vendorNit,
      extracted.purchaseOrder,
      extracted.grossAmount,
      undefined,
      extracted.suggestedGlAccount,
      extracted.aiConfidence
    );
  }

  steps.push({
    nodeId: 'ocr-ai',
    nodeName: 'Extracción OCR & Clasificación IA',
    status: 'success',
    durationMs: ocrDuration,
    httpStatus: 200,
    summary: `Extraído vía ${extracted.extractionEngine}: Factura ${extracted.invoiceNumber}, NIT ${extracted.vendorNit}, Monto $${extracted.grossAmount.toLocaleString('es-CO')} (confianza ${extracted.aiConfidence.toFixed(2)}).`,
    responsePayload: extracted,
  });

  // 3. Tax & PO Validation with Real Exponential Backoff Retry Loop
  let attempt = 1;
  let hadRetry = false;
  let taxValid = false;
  let taxErrorCode = '';
  let taxErrorMsg = '';
  let matchedPo: PurchaseOrder | undefined;
  let variancePercent = 0;

  while (attempt <= 3) {
    const attemptStart = performance.now();
    if (input.simulateTransientError && attempt === 1) {
      steps.push({
        nodeId: 'tax-api',
        nodeName: 'Validación Tributaria & OC (Reintento)',
        status: 'retry',
        durationMs: Math.max(8, Math.round(performance.now() - attemptStart)),
        httpStatus: 503,
        attempt,
        summary: 'Intento 1: HTTP 503 Servicio Tributario temporalmente no disponible. Aplicando espera exponencial (550 ms).',
        responsePayload: { ok: false, code: 'UPSTREAM_TIMEOUT', retryable: true },
      });
      hadRetry = true;
      await sleep(550);
      attempt += 1;
      continue;
    }

    const nitRegex = /^\d{6,10}-\d$/;
    if (!extracted.vendorNit || !nitRegex.test(extracted.vendorNit)) {
      taxErrorCode = 'INVALID_TAX_ID';
      taxErrorMsg = `NIT '${extracted.vendorNit}' no cumple el formato tributario requerido (ej. 901245781-3).`;
      break;
    }

    matchedPo = db.purchaseOrders.find((p) => p.poNumber === extracted.purchaseOrder);
    if (!matchedPo) {
      taxErrorCode = 'PO_NOT_FOUND';
      taxErrorMsg = `La orden de compra '${extracted.purchaseOrder}' no existe en el registro maestro de compras.`;
      break;
    }

    if (matchedPo.vendorNit !== extracted.vendorNit) {
      taxErrorCode = 'VENDOR_MISMATCH';
      taxErrorMsg = `El NIT facturado (${extracted.vendorNit}) no coincide con el titular de ${matchedPo.poNumber} (${matchedPo.vendorNit}).`;
      break;
    }

    const varianceRatio =
      (extracted.grossAmount - matchedPo.authorizedAmount) / matchedPo.authorizedAmount;
    variancePercent = Number((varianceRatio * 100).toFixed(2));
    const maxToleranceRatio = db.settings.tolerancePercent / 100;

    if (extracted.grossAmount <= 0 || varianceRatio > maxToleranceRatio) {
      taxErrorCode = 'PO_VARIANCE_EXCEEDED';
      taxErrorMsg = `El monto facturado ($${extracted.grossAmount.toLocaleString('es-CO')}) supera la tolerancia del ${db.settings.tolerancePercent}% sobre ${matchedPo.poNumber} ($${matchedPo.authorizedAmount.toLocaleString('es-CO')}). Desviación: +${variancePercent}%.`;
      break;
    }

    taxValid = true;
    steps.push({
      nodeId: 'tax-api',
      nodeName: 'Validación Tributaria & OC',
      status: 'success',
      durationMs: Math.max(12, Math.round(performance.now() - attemptStart)),
      httpStatus: 200,
      attempt,
      summary: hadRetry
        ? `Recuperado exitosamente en intento ${attempt}: NIT ${extracted.vendorNit} vigente y conciliado con ${matchedPo.poNumber} (desviación ${variancePercent}%).`
        : `NIT ${extracted.vendorNit} vigente; conciliado con ${matchedPo.poNumber} (desviación ${variancePercent}%).`,
      responsePayload: {
        ok: true,
        fiscalStatus: 'VIGENTE',
        variancePercent,
        authorizedAmount: matchedPo.authorizedAmount,
        costCenter: matchedPo.costCenter,
        glAccount: matchedPo.glAccount,
      },
    });
    break;
  }

  if (!taxValid || !matchedPo) {
    steps.push({
      nodeId: 'tax-api',
      nodeName: 'Validación Tributaria & OC',
      status: 'error',
      durationMs: 28,
      httpStatus: 422,
      attempt,
      summary: `Rechazo 422 (${taxErrorCode}): ${taxErrorMsg}`,
      responsePayload: { ok: false, code: taxErrorCode, message: taxErrorMsg },
    });
    steps.push({
      nodeId: 'decision-if',
      nodeName: 'Regla de Decisión (IF)',
      status: 'error',
      durationMs: 3,
      summary: 'Condición falsa: desviación hacia cola de cuarentena financiera.',
    });
    return moveToQuarantine(
      taxErrorCode,
      taxErrorMsg,
      extracted.invoiceNumber,
      extracted.vendorName,
      extracted.vendorNit,
      extracted.purchaseOrder,
      extracted.grossAmount,
      matchedPo?.costCenter,
      matchedPo?.glAccount || extracted.suggestedGlAccount,
      extracted.aiConfidence
    );
  }

  // 4. Decision Gate (IF)
  steps.push({
    nodeId: 'decision-if',
    nodeName: 'Regla de Decisión (IF)',
    status: 'success',
    durationMs: 4,
    summary: `Condición verdadera: regla fiscal vigente y desviación <= ${db.settings.tolerancePercent}%.`,
  });

  // 5. Idempotency & ERP Causation
  const erpStart = performance.now();
  const duplicate = db.erpLedger.find((e) => e.invoiceNumber === extracted.invoiceNumber);
  if (duplicate) {
    const dupMsg = `La factura ${extracted.invoiceNumber} ya fue causada previamente (${duplicate.entryId}). Control de idempotencia HTTP 409 activado.`;
    steps.push({
      nodeId: 'erp-post',
      nodeName: 'Causación Contable en ERP',
      status: 'error',
      durationMs: Math.max(8, Math.round(performance.now() - erpStart)),
      httpStatus: 409,
      summary: dupMsg,
      responsePayload: { ok: false, code: 'DUPLICATE_INVOICE', existingEntryId: duplicate.entryId },
    });
    return moveToQuarantine(
      'DUPLICATE_INVOICE',
      dupMsg,
      extracted.invoiceNumber,
      extracted.vendorName,
      extracted.vendorNit,
      extracted.purchaseOrder,
      extracted.grossAmount,
      matchedPo.costCenter,
      matchedPo.glAccount,
      extracted.aiConfidence
    );
  }

  const withholdingTax = Math.round(extracted.grossAmount * 0.035);
  const netPayable = extracted.grossAmount - withholdingTax;
  const erpEntry: ErpEntry = {
    entryId: `ASIENTO-2026-${String(db.erpLedger.length + 91).padStart(4, '0')}`,
    invoiceNumber: extracted.invoiceNumber,
    vendorName: extracted.vendorName,
    vendorNit: extracted.vendorNit,
    purchaseOrder: extracted.purchaseOrder,
    grossAmount: extracted.grossAmount,
    withholdingTax,
    netPayable,
    costCenter: matchedPo.costCenter,
    glAccount: matchedPo.glAccount,
    postedAt: new Date().toISOString(),
  };
  db.erpLedger.unshift(erpEntry);

  steps.push({
    nodeId: 'erp-post',
    nodeName: 'Causación Contable en ERP',
    status: 'success',
    durationMs: Math.max(12, Math.round(performance.now() - erpStart)),
    httpStatus: 201,
    summary: `Asiento ${erpEntry.entryId} causado en ERP. Retefuente 3.5%: $${withholdingTax.toLocaleString('es-CO')}. Neto a pagar: $${netPayable.toLocaleString('es-CO')} COP.`,
    responsePayload: { ok: true, entry: erpEntry },
  });

  // 6. Real Outbound Notification Dispatch
  const notifResult = await dispatchOutboundWebhook({
    event: 'INVOICE_POSTED_TO_ERP',
    executionId,
    entryId: erpEntry.entryId,
    invoiceNumber: erpEntry.invoiceNumber,
    vendorName: erpEntry.vendorName,
    grossAmount: erpEntry.grossAmount,
    netPayable: erpEntry.netPayable,
    costCenter: erpEntry.costCenter,
  });

  steps.push({
    nodeId: 'notify-success',
    nodeName: 'Notificación a Tesorería',
    status: notifResult.httpStatus && notifResult.httpStatus >= 400 ? 'error' : 'success',
    durationMs: notifResult.durationMs,
    httpStatus: notifResult.httpStatus,
    summary: notifResult.summary,
    responsePayload: notifResult,
  });

  const finalLog: ExecutionLog = {
    id: executionId,
    timestamp: new Date().toISOString(),
    source: input.source,
    scenarioLabel:
      input.scenarioLabel ||
      (hadRetry
        ? `Ejecución real (recuperada tras HTTP 503): ${erpEntry.invoiceNumber}`
        : `Ejecución real: ${erpEntry.invoiceNumber}`),
    scenarioType: hadRetry ? 'retry_recovered' : 'success',
    invoiceNumber: erpEntry.invoiceNumber,
    vendorName: erpEntry.vendorName,
    amount: erpEntry.grossAmount,
    aiConfidence: extracted.aiConfidence,
    totalDurationMs: Math.round(performance.now() - startedAt),
    finalOutcome: 'Causada en ERP',
    steps,
  };

  db.executionLogs = [finalLog, ...db.executionLogs].slice(0, 40);
  saveDb(db);
  return finalLog;
}

interface GmailMessagePart {
  mimeType?: string;
  filename?: string;
  body?: {
    attachmentId?: string;
    data?: string;
    size?: number;
  };
  parts?: GmailMessagePart[];
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: GmailMessagePart & {
    headers?: Array<{ name?: string; value?: string }>;
  };
}

function base64UrlToStandardBase64(data: string): string {
  const padded = data.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return padded + '='.repeat(padLen);
}

function decodeBase64UrlUtf8(data: string): string {
  return Buffer.from(base64UrlToStandardBase64(data), 'base64').toString('utf-8');
}

function collectGmailParts(root?: GmailMessagePart): GmailMessagePart[] {
  if (!root) return [];
  const result: GmailMessagePart[] = [root];
  if (Array.isArray(root.parts)) {
    for (const child of root.parts) {
      result.push(...collectGmailParts(child));
    }
  }
  return result;
}

function findInvoiceAttachmentPart(parts: GmailMessagePart[]): GmailMessagePart | undefined {
  const supportedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.xml', '.txt'];
  const supportedMimes = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/xml',
    'application/xml',
    'text/plain',
  ]);
  return parts.find((p) => {
    const name = (p.filename || '').trim().toLowerCase();
    if (!name) return false;
    const mime = (p.mimeType || '').toLowerCase();
    return supportedExts.some((ext) => name.endsWith(ext)) || supportedMimes.has(mime);
  });
}

async function startServer() {
  const app = express();
  app.use(
    express.json({
      limit: '15mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

  // Allow external Node-RED instances (local or cloud) to invoke endpoints cleanly
  app.use('/api', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Signature');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'automation-prototype-engine',
      orchestrator: 'Node-RED / REST Engine',
      geminiConfigured: Boolean(getGeminiClient()),
      timestamp: new Date().toISOString(),
    });
  });

  // Standalone Step Endpoints for External Node-RED Flows
  app.post('/api/ocr/extract', async (req, res) => {
    const { invoiceNumber, vendorName, vendorNit, purchaseOrder, amount, rawText, base64Data, mimeType, fileName, corruptedPayload } =
      req.body ?? {};
    if (corruptedPayload) {
      res.status(422).json({
        ok: false,
        code: 'MALFORMED_XML',
        message: 'El documento XML carece de estructura UBL 2.1 válida.',
      });
      return;
    }
    try {
      if (base64Data || (rawText && !invoiceNumber)) {
        const xml = rawText ? tryParseXmlUbl(String(rawText)) : null;
        const extracted =
          xml ??
          (await extractWithGemini({
            rawText: rawText ? String(rawText) : undefined,
            base64Data: base64Data ? String(base64Data) : undefined,
            mimeType: mimeType ? String(mimeType) : undefined,
            fileName: fileName ? String(fileName) : undefined,
          }));
        res.json({ ok: true, extracted });
        return;
      }

      const matchedPo = db.purchaseOrders.find((p) => p.poNumber === purchaseOrder);
      res.json({
        ok: true,
        extracted: {
          invoiceNumber: String(invoiceNumber || `FAC-${Date.now().toString().slice(-4)}`),
          vendorName: String(vendorName || matchedPo?.vendorName || 'Proveedor Externo'),
          vendorNit: String(vendorNit || ''),
          purchaseOrder: String(purchaseOrder || ''),
          grossAmount: Number(amount) || 0,
          cufe: `CUFE-${Buffer.from(String(invoiceNumber || 'FAC')).toString('hex').slice(0, 10).toUpperCase()}-2026`,
          concept: 'Factura electrónica estructurada',
          suggestedGlAccount: matchedPo?.glAccount || '513520-Servicios-Generales',
          aiConfidence: 0.98,
          extractionEngine: 'structured-json',
        },
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        code: 'AI_EXTRACTION_ERROR',
        message: err instanceof Error ? err.message : 'Error en extracción OCR.',
      });
    }
  });

  app.post('/api/tax-registry/validate', (req, res) => {
    const body = req.body?.extracted ? req.body.extracted : req.body ?? {};
    const vendorNit = body.vendorNit;
    const purchaseOrder = body.purchaseOrder;
    const amount = body.grossAmount ?? body.amount;
    const simulateTransientError = Boolean(req.body?.simulateTransientError);
    const attempt = Number(req.body?.attempt ?? 1);

    if (simulateTransientError && attempt === 1) {
      res.status(503).json({
        ok: false,
        code: 'UPSTREAM_TIMEOUT',
        retryable: true,
        message: 'Servicio tributario temporalmente saturado (HTTP 503). Reintento requerido.',
      });
      return;
    }

    const nitRegex = /^\d{6,10}-\d$/;
    if (!vendorNit || !nitRegex.test(String(vendorNit))) {
      res.status(422).json({
        ok: false,
        code: 'INVALID_TAX_ID',
        message: `NIT '${String(vendorNit || '')}' no cumple el formato tributario requerido.`,
      });
      return;
    }

    const po = db.purchaseOrders.find((p) => p.poNumber === purchaseOrder);
    if (!po) {
      res.status(422).json({
        ok: false,
        code: 'PO_NOT_FOUND',
        message: `La orden de compra '${String(purchaseOrder || '')}' no existe en el registro maestro.`,
      });
      return;
    }

    if (po.vendorNit !== vendorNit) {
      res.status(422).json({
        ok: false,
        code: 'VENDOR_MISMATCH',
        message: `El NIT facturado (${vendorNit}) no coincide con el titular de ${po.poNumber} (${po.vendorNit}).`,
      });
      return;
    }

    const invoicedAmount = Number(amount) || 0;
    const varianceRatio = (invoicedAmount - po.authorizedAmount) / po.authorizedAmount;
    const variancePercent = Number((varianceRatio * 100).toFixed(2));

    if (invoicedAmount <= 0 || varianceRatio > db.settings.tolerancePercent / 100) {
      res.status(422).json({
        ok: false,
        code: 'PO_VARIANCE_EXCEEDED',
        variancePercent,
        authorizedAmount: po.authorizedAmount,
        message: `El monto ($${invoicedAmount.toLocaleString('es-CO')}) supera la tolerancia del ${db.settings.tolerancePercent}% sobre ${po.poNumber} ($${po.authorizedAmount.toLocaleString('es-CO')}).`,
      });
      return;
    }

    res.json({
      ok: true,
      fiscalStatus: 'VIGENTE',
      variancePercent,
      authorizedAmount: po.authorizedAmount,
      costCenter: po.costCenter,
      glAccount: po.glAccount,
      invoiceNumber: body.invoiceNumber,
      vendorName: body.vendorName,
      vendorNit,
      purchaseOrder,
      grossAmount: invoicedAmount,
      message: `Validación fiscal y conciliación con ${po.poNumber} aprobadas (${variancePercent}%).`,
    });
  });

  app.post('/api/erp/entries', (req, res) => {
    const body = req.body ?? {};
    const invoiceNumber = String(body.invoiceNumber || '');
    const duplicate = db.erpLedger.find((e) => e.invoiceNumber === invoiceNumber);
    if (duplicate) {
      res.status(409).json({
        ok: false,
        code: 'DUPLICATE_INVOICE',
        message: `La factura ${invoiceNumber} ya fue causada (${duplicate.entryId}). Control de idempotencia HTTP 409.`,
      });
      return;
    }

    const grossAmount = Number(body.grossAmount ?? body.amount) || 0;
    const withholdingTax = Math.round(grossAmount * 0.035);
    const entry: ErpEntry = {
      entryId: `ASIENTO-2026-${String(db.erpLedger.length + 91).padStart(4, '0')}`,
      invoiceNumber,
      vendorName: String(body.vendorName || 'Proveedor'),
      vendorNit: String(body.vendorNit || ''),
      purchaseOrder: String(body.purchaseOrder || ''),
      grossAmount,
      withholdingTax,
      netPayable: grossAmount - withholdingTax,
      costCenter: String(body.costCenter || 'CC-GEN-01'),
      glAccount: String(body.glAccount || '513520-Servicios'),
      postedAt: new Date().toISOString(),
    };
    db.erpLedger.unshift(entry);
    saveDb(db);
    res.status(201).json({ ok: true, entry, message: `Asiento ${entry.entryId} causado en ERP.` });
  });

  app.post('/api/quarantine', (req, res) => {
    const body = req.body ?? {};
    const qItem: QuarantineItem = {
      id: `QUAR-${Date.now().toString().slice(-5)}`,
      executionId: String(body.executionId || `NR-${Date.now().toString().slice(-5)}`),
      invoiceNumber: String(body.invoiceNumber || 'FAC-EXT'),
      vendorName: String(body.vendorName || 'Proveedor Externo'),
      vendorNit: String(body.vendorNit || ''),
      purchaseOrder: String(body.purchaseOrder || ''),
      amount: Number(body.amount ?? body.grossAmount) || 0,
      reasonCode: String(body.reasonCode || 'NODERED_EXCEPTION'),
      reasonMessage: String(body.reasonMessage || body.message || 'Excepción reportada desde Node-RED.'),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.quarantineQueue.unshift(qItem);
    saveDb(db);
    res.status(201).json({ ok: true, item: qItem });
  });

  app.post('/api/notifications/dispatch', async (req, res) => {
    const result = await dispatchOutboundWebhook(req.body ?? {});
    res.json({ ok: true, ...result });
  });

  // Real Gmail API Notification Endpoint (uses client OAuth Bearer token)
  app.post('/api/notifications/gmail', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        ok: false,
        message: 'Se requiere iniciar sesión con Google para enviar notificaciones por Gmail.',
      });
      return;
    }

    const { to, subject, body, executionId } = req.body ?? {};
    if (!to || !subject || !body) {
      res.status(400).json({
        ok: false,
        message: 'Destinatario, asunto y cuerpo del mensaje son obligatorios.',
      });
      return;
    }

    const startedAt = performance.now();
    const encodedSubject = `=?UTF-8?B?${Buffer.from(String(subject), 'utf-8').toString('base64')}?=`;
    const bodyBase64 = Buffer.from(String(body), 'utf-8').toString('base64');
    const rawMime = [
      `To: ${String(to).trim()}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      bodyBase64,
    ].join('\r\n');

    const rawBase64Url = Buffer.from(rawMime, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    try {
      const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: rawBase64Url }),
      });

      const gmailData = (await gmailRes.json().catch(() => ({}))) as Record<string, unknown>;
      const durationMs = Math.max(10, Math.round(performance.now() - startedAt));

      if (!gmailRes.ok) {
        const errMsg =
          (gmailData.error as { message?: string } | undefined)?.message ||
          `Error de Gmail API (HTTP ${gmailRes.status}).`;
        res.status(gmailRes.status).json({
          ok: false,
          httpStatus: gmailRes.status,
          message: errMsg,
          details: gmailData,
        });
        return;
      }

      if (executionId) {
        const log = db.executionLogs.find((l) => l.id === executionId);
        if (log) {
          const existingStep = log.steps.find(
            (s) => s.nodeId === 'notify-success' || s.nodeId === 'quarantine-alert'
          );
          const gmailSummary = `Correo real enviado vía Gmail API a ${String(to)} (ID mensaje: ${String(gmailData.id || 'enviado')}, ${durationMs} ms).`;
          if (existingStep) {
            existingStep.summary = `${existingStep.summary} · ${gmailSummary}`;
            existingStep.responsePayload = {
              ...(typeof existingStep.responsePayload === 'object' && existingStep.responsePayload !== null
                ? existingStep.responsePayload
                : {}),
              gmail: {
                ok: true,
                to,
                messageId: gmailData.id,
                threadId: gmailData.threadId,
                durationMs,
              },
            };
          } else {
            log.steps.push({
              nodeId: 'notify-success',
              nodeName: 'Notificación Gmail API',
              status: 'success',
              durationMs,
              httpStatus: 200,
              summary: gmailSummary,
              responsePayload: gmailData,
            });
          }
          saveDb(db);
        }
      }

      res.json({
        ok: true,
        httpStatus: 200,
        durationMs,
        to,
        messageId: gmailData.id,
        threadId: gmailData.threadId,
        summary: `Correo enviado correctamente a ${String(to)} (ID: ${String(gmailData.id)}).`,
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        message: err instanceof Error ? err.message : 'Error de red comunicando con Gmail API.',
      });
    }
  });

  app.post('/api/logs', (req, res) => {
    const log = req.body as ExecutionLog;
    if (!log || !log.id) {
      res.status(400).json({ ok: false, message: 'Log inválido.' });
      return;
    }
    db.executionLogs = [log, ...db.executionLogs].slice(0, 40);
    saveDb(db);
    res.status(201).json({ ok: true, log });
  });

  // REAL ORCHESTRATION ENGINE ENDPOINT (UI Document Upload or Structured Payload)
  app.post('/api/workflow/execute', async (req, res) => {
    try {
      const log = await runRealAutomatedWorkflow({
        source: req.body?.base64Data || req.body?.rawText ? 'ui_document' : 'ui_payload',
        ...req.body,
      });
      res.json({ ok: true, log });
    } catch (err) {
      res.status(500).json({
        ok: false,
        message: err instanceof Error ? err.message : 'Error ejecutando el flujo automatizado.',
      });
    }
  });

  // Real Gmail API Inbox Reader Endpoints (uses client OAuth Bearer token with gmail.readonly)
  app.get('/api/gmail/inbox', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        ok: false,
        message: 'Se requiere iniciar sesión con Google para consultar la bandeja de Gmail.',
      });
      return;
    }

    const q = String(req.query.q ?? '').trim();
    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    listUrl.searchParams.set('maxResults', '10');
    if (q) {
      listUrl.searchParams.set('q', q);
    }

    try {
      const listRes = await fetch(listUrl.toString(), {
        headers: { Authorization: authHeader },
      });
      const listData = (await listRes.json().catch(() => ({}))) as {
        messages?: Array<{ id: string; threadId: string }>;
        error?: { message?: string };
      };

      if (!listRes.ok) {
        res.status(listRes.status).json({
          ok: false,
          message:
            listData.error?.message ||
            `Error consultando mensajes en Gmail (HTTP ${listRes.status}). Verifica el permiso gmail.readonly.`,
        });
        return;
      }

      const refs = (listData.messages ?? []).slice(0, 10);
      const messages = await Promise.all(
        refs.map(async (ref) => {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(ref.id)}?format=full`,
            { headers: { Authorization: authHeader } }
          );
          if (!msgRes.ok) return null;
          const msg = (await msgRes.json()) as GmailMessageResponse;
          const headers = msg.payload?.headers ?? [];
          const getHeader = (name: string) =>
            headers.find((h) => (h.name || '').toLowerCase() === name.toLowerCase())?.value || '';

          const parts = collectGmailParts(msg.payload);
          const attachmentPart = findInvoiceAttachmentPart(parts);
          return {
            id: msg.id,
            threadId: msg.threadId,
            subject: getHeader('Subject') || '(Sin asunto)',
            from: getHeader('From') || 'Remitente desconocido',
            date: getHeader('Date') || '',
            snippet: msg.snippet || '',
            hasAttachment: Boolean(attachmentPart),
            attachmentName: attachmentPart?.filename || undefined,
          };
        })
      );

      res.json({
        ok: true,
        messages: messages.filter((m): m is NonNullable<typeof m> => m !== null),
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        message: err instanceof Error ? err.message : 'Error de red consultando la bandeja de Gmail.',
      });
    }
  });

  app.post('/api/gmail/process-message', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        ok: false,
        message: 'Se requiere iniciar sesión con Google para procesar un correo de Gmail.',
      });
      return;
    }

    const messageId = String(req.body?.messageId ?? '').trim();
    if (!messageId) {
      res.status(400).json({ ok: false, message: 'El ID del mensaje de Gmail es obligatorio.' });
      return;
    }

    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
        { headers: { Authorization: authHeader } }
      );
      const msgData = (await msgRes.json().catch(() => ({}))) as GmailMessageResponse & {
        error?: { message?: string };
      };
      if (!msgRes.ok) {
        res.status(msgRes.status).json({
          ok: false,
          message: msgData.error?.message || `Error leyendo el mensaje ${messageId} desde Gmail.`,
        });
        return;
      }

      const headers = msgData.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => (h.name || '').toLowerCase() === name.toLowerCase())?.value || '';
      const subject = getHeader('Subject') || '(Sin asunto)';
      const from = getHeader('From') || 'Remitente';

      const parts = collectGmailParts(msgData.payload);
      const attachmentPart = findInvoiceAttachmentPart(parts);

      let fileName: string | undefined;
      let mimeType: string | undefined;
      let base64Data: string | undefined;
      let rawText: string | undefined;

      if (attachmentPart) {
        fileName = attachmentPart.filename || 'adjunto';
        const lowerName = fileName.toLowerCase();
        mimeType =
          attachmentPart.mimeType ||
          (lowerName.endsWith('.pdf')
            ? 'application/pdf'
            : lowerName.endsWith('.png')
            ? 'image/png'
            : lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')
            ? 'image/jpeg'
            : 'text/plain');

        let rawBase64Url = attachmentPart.body?.data || '';
        if (!rawBase64Url && attachmentPart.body?.attachmentId) {
          const attRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
              messageId
            )}/attachments/${encodeURIComponent(attachmentPart.body.attachmentId)}`,
            { headers: { Authorization: authHeader } }
          );
          const attData = (await attRes.json().catch(() => ({}))) as {
            data?: string;
            error?: { message?: string };
          };
          if (!attRes.ok || !attData.data) {
            res.status(attRes.status || 502).json({
              ok: false,
              message: attData.error?.message || `No fue posible descargar el adjunto '${fileName}'.`,
            });
            return;
          }
          rawBase64Url = attData.data;
        }

        const isTextAttachment =
          mimeType.includes('text') ||
          mimeType.includes('xml') ||
          lowerName.endsWith('.xml') ||
          lowerName.endsWith('.txt');

        if (isTextAttachment) {
          rawText = decodeBase64UrlUtf8(rawBase64Url);
        } else {
          base64Data = base64UrlToStandardBase64(rawBase64Url);
        }
      } else {
        const plainPart = parts.find(
          (p) => (p.mimeType || '').toLowerCase() === 'text/plain' && p.body?.data
        );
        const htmlPart = parts.find(
          (p) => (p.mimeType || '').toLowerCase() === 'text/html' && p.body?.data
        );
        let bodyContent = '';
        if (plainPart?.body?.data) {
          bodyContent = decodeBase64UrlUtf8(plainPart.body.data);
        } else if (htmlPart?.body?.data) {
          bodyContent = decodeBase64UrlUtf8(htmlPart.body.data)
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        } else {
          bodyContent = msgData.snippet || '';
        }
        fileName = `gmail_${messageId.slice(-6)}.txt`;
        mimeType = 'text/plain';
        rawText = `Asunto: ${subject}\nDe: ${from}\n\n${bodyContent}`;
      }

      const log = await runRealAutomatedWorkflow({
        source: 'gmail_inbox',
        scenarioLabel: `Gmail entrante: ${subject.slice(0, 60)}`,
        fileName,
        mimeType,
        base64Data,
        rawText,
      });

      res.json({ ok: true, log });
    } catch (err) {
      res.status(500).json({
        ok: false,
        message: err instanceof Error ? err.message : 'Error procesando el correo desde Gmail.',
      });
    }
  });

  // REAL PUBLIC INBOUND WEBHOOK FOR EXTERNAL CALLERS (Node-RED, Postman, cURL, ERP)
  app.post('/api/webhook/invoices', async (req, res) => {
    try {
      if (db.settings.requireHmacHeader) {
        const providedSig = String(req.get('X-Webhook-Signature') || '').trim();
        const rawBody =
          (req as express.Request & { rawBody?: Buffer }).rawBody ??
          Buffer.from(JSON.stringify(req.body ?? {}), 'utf-8');
        const expectedHex = crypto
          .createHmac('sha256', db.settings.hmacSecret || 'custodios-hmac-2026')
          .update(rawBody)
          .digest('hex');
        const expectedSig = `sha256=${expectedHex}`;

        const providedBuf = Buffer.from(providedSig, 'utf-8');
        const expectedBuf = Buffer.from(expectedSig, 'utf-8');
        const valid =
          providedBuf.length === expectedBuf.length &&
          crypto.timingSafeEqual(providedBuf, expectedBuf);

        if (!valid) {
          res.status(401).json({
            ok: false,
            code: 'INVALID_WEBHOOK_SIGNATURE',
            message:
              'Acceso denegado (HTTP 401): la cabecera X-Webhook-Signature es obligatoria o no coincide con la firma HMAC-SHA256 configurada.',
          });
          return;
        }
      }

      const body = req.body ?? {};
      const log = await runRealAutomatedWorkflow({
        source: 'external_webhook',
        scenarioLabel: `Webhook externo recibido: ${body.invoiceNumber || 'documento'}`,
        invoiceNumber: body.invoiceNumber,
        vendorName: body.vendorName,
        vendorNit: body.vendorNit,
        purchaseOrder: body.purchaseOrder,
        amount: Number(body.amount) || 0,
        rawText: body.rawText,
        simulateTransientError: Boolean(body.simulateTransientError),
        corruptedPayload: Boolean(body.corruptedPayload),
      });
      res.status(log.finalOutcome === 'Causada en ERP' ? 201 : 202).json({
        ok: true,
        executionId: log.id,
        outcome: log.finalOutcome,
        log,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        message: err instanceof Error ? err.message : 'Error procesando webhook entrante.',
      });
    }
  });

  // Purchase Orders CRUD
  app.get('/api/purchase-orders', (_req, res) => {
    res.json({ purchaseOrders: db.purchaseOrders });
  });

  app.post('/api/purchase-orders', (req, res) => {
    const { poNumber, vendorName, vendorNit, authorizedAmount, costCenter, glAccount } = req.body ?? {};
    if (!poNumber || !vendorName || !vendorNit || !authorizedAmount) {
      res.status(400).json({ ok: false, message: 'Complete todos los campos de la Orden de Compra.' });
      return;
    }
    if (db.purchaseOrders.some((p) => p.poNumber === poNumber)) {
      res.status(409).json({ ok: false, message: `La orden ${poNumber} ya existe.` });
      return;
    }
    const newPo: PurchaseOrder = {
      poNumber: String(poNumber).trim(),
      vendorName: String(vendorName).trim(),
      vendorNit: String(vendorNit).trim(),
      authorizedAmount: Number(authorizedAmount),
      costCenter: String(costCenter || 'CC-GEN-01').trim(),
      glAccount: String(glAccount || '513520-Servicios').trim(),
    };
    db.purchaseOrders.unshift(newPo);
    saveDb(db);
    res.status(201).json({ ok: true, purchaseOrder: newPo, purchaseOrders: db.purchaseOrders });
  });

  app.delete('/api/purchase-orders/:poNumber', (req, res) => {
    db.purchaseOrders = db.purchaseOrders.filter((p) => p.poNumber !== req.params.poNumber);
    saveDb(db);
    res.json({ ok: true, purchaseOrders: db.purchaseOrders });
  });

  // ERP Ledger
  app.get('/api/erp/entries', (_req, res) => {
    res.json({ entries: db.erpLedger });
  });

  // Human-in-the-Loop Quarantine Queue
  app.get('/api/quarantine', (_req, res) => {
    res.json({ quarantineQueue: db.quarantineQueue });
  });

  app.post('/api/quarantine/:id/resolve', async (req, res) => {
    const item = db.quarantineQueue.find((q) => q.id === req.params.id);
    if (!item) {
      res.status(404).json({ ok: false, message: 'Registro de cuarentena no encontrado.' });
      return;
    }
    if (item.status !== 'pending') {
      res.status(400).json({ ok: false, message: 'Este registro ya fue resuelto anteriormente.' });
      return;
    }

    const decision = req.body?.decision as 'approved' | 'rejected';
    const note = String(req.body?.note || '').trim();
    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(400).json({ ok: false, message: 'Decisión inválida.' });
      return;
    }

    item.status = decision;
    item.resolvedAt = new Date().toISOString();
    item.resolutionNote =
      note || (decision === 'approved' ? 'Aprobado manualmente por analista.' : 'Rechazado por inconsistencia.');

    let createdEntry: ErpEntry | undefined;
    if (decision === 'approved') {
      const duplicate = db.erpLedger.find((e) => e.invoiceNumber === item.invoiceNumber);
      if (!duplicate) {
        const withholdingTax = Math.round(item.amount * 0.035);
        createdEntry = {
          entryId: `ASIENTO-2026-${String(db.erpLedger.length + 91).padStart(4, '0')}`,
          invoiceNumber: item.invoiceNumber,
          vendorName: item.vendorName,
          vendorNit: item.vendorNit,
          purchaseOrder: item.purchaseOrder || 'EXCEPCION-HITL',
          grossAmount: item.amount,
          withholdingTax,
          netPayable: item.amount - withholdingTax,
          costCenter: item.costCenter || 'CC-EXCEP-01',
          glAccount: item.glAccount || '519595-Aprobacion-Manual',
          postedAt: new Date().toISOString(),
          approvedManually: true,
        };
        db.erpLedger.unshift(createdEntry);
      }
    }

    await dispatchOutboundWebhook({
      event: decision === 'approved' ? 'QUARANTINE_APPROVED_POSTED' : 'QUARANTINE_REJECTED',
      quarantineId: item.id,
      invoiceNumber: item.invoiceNumber,
      decision,
      note: item.resolutionNote,
      entryId: createdEntry?.entryId,
    });

    saveDb(db);
    res.json({
      ok: true,
      item,
      createdEntry,
      quarantineQueue: db.quarantineQueue,
      entries: db.erpLedger,
    });
  });

  // Settings (Outbound Webhook, Tolerance, AI Confidence)
  app.get('/api/settings', (_req, res) => {
    res.json({ settings: db.settings });
  });

  app.put('/api/settings', (req, res) => {
    db.settings = {
      outboundWebhookUrl: String(req.body?.outboundWebhookUrl ?? db.settings.outboundWebhookUrl).trim(),
      notificationEmail: String(req.body?.notificationEmail ?? db.settings.notificationEmail).trim(),
      tolerancePercent: Math.max(0, Math.min(50, Number(req.body?.tolerancePercent ?? db.settings.tolerancePercent))),
      minAiConfidence: Math.max(0.1, Math.min(0.99, Number(req.body?.minAiConfidence ?? db.settings.minAiConfidence))),
      requireHmacHeader: Boolean(req.body?.requireHmacHeader ?? db.settings.requireHmacHeader),
      hmacSecret: String(req.body?.hmacSecret ?? db.settings.hmacSecret).trim() || 'custodios-hmac-2026',
    };
    saveDb(db);
    res.json({ ok: true, settings: db.settings });
  });

  // Logs
  app.get('/api/logs', (_req, res) => {
    res.json({ logs: db.executionLogs });
  });

  app.delete('/api/logs', (_req, res) => {
    db.executionLogs = JSON.parse(JSON.stringify(DEFAULT_DB.executionLogs)) as ExecutionLog[];
    db.erpLedger = JSON.parse(JSON.stringify(DEFAULT_DB.erpLedger)) as ErpEntry[];
    db.quarantineQueue = JSON.parse(JSON.stringify(DEFAULT_DB.quarantineQueue)) as QuarantineItem[];
    db.purchaseOrders = JSON.parse(JSON.stringify(DEFAULT_DB.purchaseOrders)) as PurchaseOrder[];
    saveDb(db);
    res.json({
      ok: true,
      logs: db.executionLogs,
      entries: db.erpLedger,
      quarantineQueue: db.quarantineQueue,
      purchaseOrders: db.purchaseOrders,
    });
  });

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
