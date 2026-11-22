import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileUp,
  Inbox,
  Lock,
  LogOut,
  Mail,
  Paperclip,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Webhook,
} from 'lucide-react';
import {
  TEST_PRESETS,
  WORKFLOW_NODES,
  generateNodeRedFlowJson,
} from '../data/projectContent';
import { EmailConfirmationModal, PendingEmailDraft } from './EmailConfirmationModal';
import {
  ErpEntry,
  ExecutionLog,
  GmailInboxMessage,
  InvoiceTestPayload,
  PurchaseOrder,
  QuarantineItem,
  WorkflowSettings,
} from '../types/automation';

interface WorkflowPrototypeViewProps {
  onExecutionComplete: (log: ExecutionLog) => void;
  erpEntries: ErpEntry[];
  purchaseOrders: PurchaseOrder[];
  quarantineQueue: QuarantineItem[];
  settings: WorkflowSettings;
  onRefreshState: () => Promise<void>;
  googleUserEmail: string | null;
  googleToken: string | null;
  isLoggingIn: boolean;
  authError: string;
  onGoogleSignIn: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
}

type NodeRuntimeState = 'idle' | 'running' | 'retry' | 'success' | 'error' | 'skipped';
type InputMode = 'document' | 'payload' | 'webhook' | 'gmail';
type OperationsTab = 'quarantine' | 'erp' | 'pos';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function computeHmacSha256Header(secret: string, bodyString: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secret || 'custodios-hmac-2026'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await window.crypto.subtle.sign('HMAC', key, enc.encode(bodyString));
  const hex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256=${hex}`;
}

const SAMPLE_RAW_INVOICE_TEXT = `FACTURA ELECTRONICA DE VENTA No. FAC-2026-0912
Emisor: Soluciones Cloud Andina S.A.S.
NIT: 901245781-3
Fecha de Emision: 2026-11-21
Orden de Compra Referencia: OC-2026-4490
Detalle: Renovacion infraestructura nube y respaldo mensual
Subtotal: $4.250.000 COP
Total a Pagar: $4.250.000 COP
CUFE: 9f8a2b7c1d4e6f001122334455667788aabbccdd`;

export const WorkflowPrototypeView: React.FC<WorkflowPrototypeViewProps> = ({
  onExecutionComplete,
  erpEntries,
  purchaseOrders,
  quarantineQueue,
  settings,
  onRefreshState,
  googleUserEmail,
  googleToken,
  isLoggingIn,
  authError,
  onGoogleSignIn,
  onGoogleLogout,
}) => {
  const [inputMode, setInputMode] = useState<InputMode>('document');
  const [opsTab, setOpsTab] = useState<OperationsTab>('quarantine');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('ocr-ai');

  // Mode 1: Real file / text document state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{
    fileName: string;
    mimeType: string;
    base64Data?: string;
    rawText?: string;
  } | null>(null);
  const [rawInvoiceText, setRawInvoiceText] = useState<string>(SAMPLE_RAW_INVOICE_TEXT);

  // Mode 2: Structured payload state
  const [payload, setPayload] = useState<InvoiceTestPayload>(TEST_PRESETS[0]);

  // Mode 3: Webhook & Settings state
  const [localSettings, setLocalSettings] = useState<WorkflowSettings>(settings);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string>('');
  const [copiedCurl, setCopiedCurl] = useState<boolean>(false);
  const [sampleHmacSignature, setSampleHmacSignature] = useState<string>('');
  const [webhookTestNotice, setWebhookTestNotice] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // Mode 4: Gmail Inbox Reader state
  const [gmailQuery, setGmailQuery] = useState<string>('factura');
  const [inboxMessages, setInboxMessages] = useState<GmailInboxMessage[]>([]);
  const [loadingInbox, setLoadingInbox] = useState<boolean>(false);
  const [inboxError, setInboxError] = useState<string>('');
  const [processingMessageId, setProcessingMessageId] = useState<string | null>(null);

  // Gmail Notification state
  const [autoPromptGmail, setAutoPromptGmail] = useState<boolean>(true);
  const [pendingEmailDraft, setPendingEmailDraft] = useState<PendingEmailDraft | null>(null);
  const [sendingGmail, setSendingGmail] = useState<boolean>(false);
  const [gmailError, setGmailError] = useState<string>('');
  const [gmailSuccessMsg, setGmailSuccessMsg] = useState<string>('');

  // Execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runError, setRunError] = useState<string>('');
  const [nodeStates, setNodeStates] = useState<Record<string, NodeRuntimeState>>({});
  const [lastTrace, setLastTrace] = useState<ExecutionLog | null>(null);

  // New PO form state
  const [newPo, setNewPo] = useState({
    poNumber: 'OC-2026-4600',
    vendorName: 'Tecnología Empresarial Sur S.A.S.',
    vendorNit: '901555321-4',
    authorizedAmount: 3500000,
    costCenter: 'CC-TI-09',
    glAccount: '513520-Servicios-TI',
  });
  const [poError, setPoError] = useState<string>('');

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const sampleWebhookBody = `{
  "invoiceNumber": "FAC-2026-0950",
  "vendorName": "Soluciones Cloud Andina S.A.S.",
  "vendorNit": "901245781-3",
  "purchaseOrder": "OC-2026-4490",
  "amount": 4250000
}`;

  useEffect(() => {
    let active = true;
    computeHmacSha256Header(localSettings.hmacSecret, sampleWebhookBody).then((sig) => {
      if (active) setSampleHmacSignature(sig);
    });
    return () => {
      active = false;
    };
  }, [localSettings.hmacSecret, sampleWebhookBody]);

  const selectedNode = WORKFLOW_NODES.find((n) => n.id === selectedNodeId) ?? WORKFLOW_NODES[0];
  const selectedStepTrace = lastTrace?.steps.find((s) => s.nodeId === selectedNodeId);

  const buildEmailDraftFromTrace = (log: ExecutionLog): PendingEmailDraft => {
    const isSuccess = log.finalOutcome === 'Causada en ERP';
    const stepSummary = log.steps
      .map((s, idx) => `${idx + 1}. ${s.nodeName} [${s.httpStatus ?? 200}]: ${s.summary}`)
      .join('\n');

    return {
      executionId: log.id,
      to: localSettings.notificationEmail || 'danielricardomorenortiz@gmail.com',
      subject: isSuccess
        ? `[ERP Causado] Factura ${log.invoiceNumber} — ${log.vendorName}`
        : `[Alerta Cuarentena HITL] Factura ${log.invoiceNumber} requiere revisión`,
      body: [
        `Notificación automática del flujo de Cuentas por Pagar (Custodios de la Innovación — Node-RED)`,
        ``,
        `ID de Ejecución: ${log.id}`,
        `Resultado final: ${log.finalOutcome}`,
        `Factura: ${log.invoiceNumber}`,
        `Proveedor: ${log.vendorName}`,
        `Valor bruto: $${log.amount.toLocaleString('es-CO')} COP`,
        `Duración total: ${log.totalDurationMs} ms`,
        ``,
        `Traza paso a paso:`,
        stepSummary,
      ].join('\n'),
    };
  };

  const handleConfirmSendGmail = async (finalDraft: PendingEmailDraft) => {
    if (!googleToken) {
      setGmailError('Debes iniciar sesión con Google antes de enviar correos.');
      return;
    }
    setSendingGmail(true);
    setGmailError('');
    setGmailSuccessMsg('');
    try {
      const res = await fetch('/api/notifications/gmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${googleToken}`,
        },
        body: JSON.stringify(finalDraft),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'No fue posible enviar la notificación por Gmail.');
      }
      setGmailSuccessMsg(
        `Notificación enviada por Gmail a ${data.to} (ID de mensaje: ${data.messageId || 'confirmado'}).`
      );
      setPendingEmailDraft(null);
      await onRefreshState();
    } catch (err) {
      setGmailError(
        err instanceof Error ? err.message : 'Error enviando el correo mediante Gmail API.'
      );
    } finally {
      setSendingGmail(false);
    }
  };

  const inboundWebhookUrl = `${window.location.origin}/api/webhook/invoices`;
  const curlCommand = localSettings.requireHmacHeader
    ? `curl -X POST "${inboundWebhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Signature: ${sampleHmacSignature || 'sha256=...'}" \\
  -d '${sampleWebhookBody}'`
    : `curl -X POST "${inboundWebhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${sampleWebhookBody}'`;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRunError('');

    const isTextLike =
      file.type.includes('text') ||
      file.name.toLowerCase().endsWith('.xml') ||
      file.name.toLowerCase().endsWith('.txt');

    if (isTextLike) {
      const text = await file.text();
      setUploadedFile({
        fileName: file.name,
        mimeType: file.type || 'text/plain',
        rawText: text,
      });
      setRawInvoiceText(text);
    } else {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);
      setUploadedFile({
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
        base64Data,
      });
    }
  };

  const handleSelectPreset = (index: number) => {
    const preset = TEST_PRESETS[index];
    if (!preset) return;
    const uniqueSuffix = Math.floor(100 + Math.random() * 899);
    setPayload({
      ...preset,
      invoiceNumber: `FAC-2026-${uniqueSuffix}`,
    });
  };

  const animateTraceToCanvas = async (log: ExecutionLog) => {
    setNodeStates({
      'trigger-webhook': 'running',
      'ocr-ai': 'idle',
      'tax-api': 'idle',
      'decision-if': 'idle',
      'erp-post': 'idle',
      'notify-success': 'idle',
      'quarantine-alert': 'idle',
    });

    for (const step of log.steps) {
      setNodeStates((prev) => ({
        ...prev,
        [step.nodeId]: step.status === 'retry' ? 'retry' : 'running',
      }));
      await sleep(160);
      setNodeStates((prev) => ({
        ...prev,
        [step.nodeId]: step.status,
      }));
    }

    // Mark unreached nodes as skipped
    setNodeStates((prev) => {
      const next = { ...prev };
      for (const node of WORKFLOW_NODES) {
        if (!next[node.id] || next[node.id] === 'idle') {
          next[node.id] = 'skipped';
        }
      }
      return next;
    });
  };

  const runServerWorkflow = async (
    requestBody: Record<string, unknown>,
    endpoint = '/api/workflow/execute',
    extraHeaders?: Record<string, string>
  ) => {
    if (isRunning) return;
    setIsRunning(true);
    setRunError('');
    setWebhookTestNotice(null);
    setNodeStates({ 'trigger-webhook': 'running' });

    try {
      const serialized = JSON.stringify(requestBody);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(extraHeaders ?? {}),
        },
        body: serialized,
      });
      const data = await res.json();
      if (!res.ok && !data.log) {
        if (endpoint === '/api/webhook/invoices') {
          setWebhookTestNotice({
            ok: false,
            text: `HTTP ${res.status} (${data.code || 'ERROR'}): ${data.message || 'Petición rechazada.'}`,
          });
        }
        throw new Error(data.message || 'Error ejecutando el motor de automatización.');
      }
      const log: ExecutionLog = data.log;
      await animateTraceToCanvas(log);
      setLastTrace(log);
      onExecutionComplete(log);
      await onRefreshState();
      if (endpoint === '/api/webhook/invoices') {
        setWebhookTestNotice({
          ok: true,
          text: `HTTP ${res.status} aceptado · ${log.id} (${log.finalOutcome})`,
        });
      }
      if (autoPromptGmail && googleToken) {
        setGmailError('');
        setPendingEmailDraft(buildEmailDraftFromTrace(log));
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Fallo inesperado de ejecución.');
      setNodeStates({});
    } finally {
      setIsRunning(false);
    }
  };

  const handleTestWebhook = async (signed: boolean) => {
    const uniqueNum = `FAC-WH-${Math.floor(100 + Math.random() * 899)}`;
    const bodyObj = {
      invoiceNumber: uniqueNum,
      vendorName: 'Soluciones Cloud Andina S.A.S.',
      vendorNit: '901245781-3',
      purchaseOrder: 'OC-2026-4490',
      amount: 4250000,
    };
    if (signed) {
      const signature = await computeHmacSha256Header(
        localSettings.hmacSecret || settings.hmacSecret,
        JSON.stringify(bodyObj)
      );
      await runServerWorkflow(bodyObj, '/api/webhook/invoices', {
        'X-Webhook-Signature': signature,
      });
    } else {
      await runServerWorkflow(bodyObj, '/api/webhook/invoices');
    }
  };

  const fetchGmailInbox = async (queryOverride?: string) => {
    if (!googleToken) return;
    setLoadingInbox(true);
    setInboxError('');
    try {
      const q = (queryOverride ?? gmailQuery).trim();
      const url = `/api/gmail/inbox${q ? `?q=${encodeURIComponent(q)}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${googleToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'No fue posible consultar la bandeja de Gmail.');
      }
      setInboxMessages(data.messages || []);
    } catch (err) {
      setInboxError(err instanceof Error ? err.message : 'Error leyendo correos de Gmail.');
    } finally {
      setLoadingInbox(false);
    }
  };

  const handleProcessGmailMessage = async (msg: GmailInboxMessage) => {
    if (!googleToken || isRunning) return;
    setProcessingMessageId(msg.id);
    setIsRunning(true);
    setRunError('');
    setInboxError('');
    setNodeStates({ 'trigger-webhook': 'running' });

    try {
      const res = await fetch('/api/gmail/process-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${googleToken}`,
        },
        body: JSON.stringify({ messageId: msg.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.log) {
        throw new Error(data.message || 'Error procesando el mensaje de Gmail.');
      }
      const log: ExecutionLog = data.log;
      await animateTraceToCanvas(log);
      setLastTrace(log);
      onExecutionComplete(log);
      await onRefreshState();
      if (autoPromptGmail) {
        setGmailError('');
        setPendingEmailDraft(buildEmailDraftFromTrace(log));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fallo procesando el correo.';
      setInboxError(message);
      setRunError(message);
      setNodeStates({});
    } finally {
      setProcessingMessageId(null);
      setIsRunning(false);
    }
  };

  const handleExecuteActiveMode = () => {
    if (inputMode === 'document') {
      if (uploadedFile) {
        runServerWorkflow({
          scenarioLabel: `Documento real: ${uploadedFile.fileName}`,
          fileName: uploadedFile.fileName,
          mimeType: uploadedFile.mimeType,
          base64Data: uploadedFile.base64Data,
          rawText: uploadedFile.rawText,
        });
      } else {
        runServerWorkflow({
          scenarioLabel: 'Extracción IA desde texto de factura',
          fileName: 'factura_texto.txt',
          mimeType: 'text/plain',
          rawText: rawInvoiceText,
        });
      }
    } else if (inputMode === 'payload') {
      runServerWorkflow({ ...payload });
    } else if (inputMode === 'webhook') {
      handleTestWebhook(settings.requireHmacHeader);
    } else {
      fetchGmailInbox();
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSavedMsg('');
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localSettings),
    });
    if (res.ok) {
      setSettingsSavedMsg('Configuración guardada en el motor.');
      await onRefreshState();
    }
  };

  const handleResolveQuarantine = async (id: string, decision: 'approved' | 'rejected') => {
    const res = await fetch(`/api/quarantine/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        note:
          decision === 'approved'
            ? 'Aprobado manualmente tras verificación de excepción financiera.'
            : 'Rechazado por incumplimiento de orden de compra.',
      }),
    });
    if (res.ok) {
      await onRefreshState();
    }
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPoError('');
    const res = await fetch('/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPo),
    });
    const data = await res.json();
    if (!res.ok) {
      setPoError(data.message || 'No fue posible crear la OC.');
      return;
    }
    setNewPo({
      ...newPo,
      poNumber: `OC-2026-${Math.floor(4601 + Math.random() * 398)}`,
    });
    await onRefreshState();
  };

  const handleDeletePo = async (poNumber: string) => {
    await fetch(`/api/purchase-orders/${encodeURIComponent(poNumber)}`, {
      method: 'DELETE',
    });
    await onRefreshState();
  };

  const handleDownloadNodeRedJson = () => {
    const data = generateNodeRedFlowJson(window.location.origin);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'flujo_nodered_cuentas_por_pagar.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const handleExportErpCsv = () => {
    const headers = [
      'ASIENTO',
      'Factura',
      'NIT',
      'Proveedor',
      'OC',
      'CuentaPUC',
      'CentroCosto',
      'ValorBruto',
      'Retefuente',
      'NetoPagar',
      'Fecha',
    ];
    const rows = erpEntries.map((e) => [
      e.entryId,
      e.invoiceNumber,
      e.vendorNit,
      `"${e.vendorName.replace(/"/g, '""')}"`,
      e.purchaseOrder,
      e.glAccount,
      e.costCenter,
      e.grossAmount,
      e.withholdingTax,
      e.netPayable,
      e.postedAt,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'asientos_contables_erp.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getNodeBorderStyle = (nodeId: string) => {
    const state = nodeStates[nodeId] || 'idle';
    if (state === 'running') return 'border-blue-600 ring-2 ring-blue-100 bg-blue-50/40';
    if (state === 'retry') return 'border-amber-500 ring-2 ring-amber-100 bg-amber-50/50';
    if (state === 'success') return 'border-emerald-600 bg-emerald-50/30';
    if (state === 'error') return 'border-red-600 bg-red-50/40';
    if (state === 'skipped') return 'border-slate-200 bg-slate-50 opacity-55';
    if (selectedNodeId === nodeId) return 'border-blue-700 ring-2 ring-blue-100 bg-white';
    return 'border-slate-300 bg-white';
  };

  const renderStateLabel = (nodeId: string) => {
    const state = nodeStates[nodeId] || 'idle';
    if (state === 'running')
      return <span className="text-[11px] font-medium text-blue-700">Ejecutando…</span>;
    if (state === 'retry')
      return <span className="text-[11px] font-medium text-amber-700">Reintentando (503)</span>;
    if (state === 'success')
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5" /> Completado
        </span>
      );
    if (state === 'error')
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700">
          <AlertTriangle className="w-3.5 h-3.5" /> Error controlado
        </span>
      );
    if (state === 'skipped')
      return <span className="text-[11px] text-slate-400">Omitido</span>;
    return <span className="text-[11px] text-slate-400">Listo</span>;
  };

  const pendingQuarantineCount = quarantineQueue.filter((q) => q.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Execution Control Center */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Motor Real de Automatización · Persistencia en Servidor + OCR Gemini + Webhooks
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">
              Flujo Automatizado Funcional de Cuentas por Pagar
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDownloadNodeRedJson}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exportar flows.json (Node-RED)</span>
            </button>
            <button
              type="button"
              onClick={handleExecuteActiveMode}
              disabled={isRunning || (inputMode === 'gmail' && (!googleToken || loadingInbox))}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>
                {isRunning
                  ? 'Procesando en servidor…'
                  : inputMode === 'document'
                  ? 'Ejecutar Flujo con Documento Real'
                  : inputMode === 'webhook'
                  ? 'Probar Webhook Entrante'
                  : inputMode === 'gmail'
                  ? 'Actualizar Bandeja Gmail'
                  : 'Ejecutar Escenario'}
              </span>
            </button>
          </div>
        </div>

        {/* Mode Segmented Tabs */}
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setInputMode('document')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              inputMode === 'document'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Factura Real (PDF / Imagen / XML / Texto)
          </button>
          <button
            type="button"
            onClick={() => setInputMode('payload')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              inputMode === 'payload'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Carga Estructurada y Pruebas de Fallo
          </button>
          <button
            type="button"
            onClick={() => setInputMode('webhook')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              inputMode === 'webhook'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Webhooks Reales y Seguridad HMAC
          </button>
          <button
            type="button"
            onClick={() => {
              setInputMode('gmail');
              if (googleToken && inboxMessages.length === 0) {
                fetchGmailInbox();
              }
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              inputMode === 'gmail'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            4. Bandeja Gmail (Entrada)
          </button>
        </div>

        {/* Gmail Notification Integration Bar */}
        <div className="border border-slate-200 rounded-lg bg-slate-50/70 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <Mail className="w-4 h-4 text-blue-700" />
              <span>Notificación Real por Gmail</span>
              <span className="text-slate-400" aria-hidden="true">
                ·
              </span>
              <span className="font-mono font-normal text-slate-600">
                Destinatario: {localSettings.notificationEmail || 'danielricardomorenortiz@gmail.com'}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              {googleToken
                ? `Conectado con ${googleUserEmail || 'Google'}. Al finalizar un flujo se abrirá la confirmación para enviar el correo real.`
                : 'Inicia sesión con tu cuenta de Google para autorizar el envío real de notificaciones a tu correo.'}
            </p>
            {authError && <p className="text-xs text-red-700">{authError}</p>}
            {gmailSuccessMsg && (
              <p className="text-xs font-medium text-emerald-700">{gmailSuccessMsg}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {googleToken ? (
              <>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPromptGmail}
                    onChange={(e) => setAutoPromptGmail(e.target.checked)}
                    className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />
                  <span>Solicitar envío al finalizar</span>
                </label>
                {lastTrace && (
                  <button
                    type="button"
                    onClick={() => {
                      setGmailError('');
                      setPendingEmailDraft(buildEmailDraftFromTrace(lastTrace));
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-800 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Enviar última corrida</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onGoogleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Desconectar</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onGoogleSignIn}
                disabled={isLoggingIn}
                className="inline-flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>{isLoggingIn ? 'Conectando…' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>
        </div>

        {runError && (
          <div className="p-3.5 text-xs text-red-800 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{runError}</span>
          </div>
        )}

        {/* Mode 1: Real Document Upload & Gemini OCR */}
        {inputMode === 'document' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-3">
              <p className="text-xs font-semibold text-slate-700">
                Subir Archivo de Factura (PDF, PNG, JPG, XML UBL, TXT)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.xml,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-slate-300 hover:border-blue-600 bg-slate-50/70 rounded-lg p-6 text-center cursor-pointer transition-colors space-y-2"
              >
                <FileUp className="w-6 h-6 text-blue-700 mx-auto" />
                {uploadedFile ? (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-900">{uploadedFile.fileName}</p>
                    <p className="text-[11px] text-slate-500">
                      Listo para extracción real con Gemini OCR / Parser XML · Clic para cambiar
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-800">
                      Haga clic para seleccionar una factura real
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Soporta PDF, imágenes (PNG/JPG), XML UBL o texto plano
                    </p>
                  </div>
                )}
              </div>
              {uploadedFile && (
                <button
                  type="button"
                  onClick={() => setUploadedFile(null)}
                  className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
                >
                  Quitar archivo y usar texto de factura abajo
                </button>
              )}
            </div>

            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">
                  O pegue contenido de factura / XML UBL (procesado por Gemini OCR)
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFile(null);
                    setRawInvoiceText(SAMPLE_RAW_INVOICE_TEXT);
                  }}
                  className="text-xs text-blue-700 hover:underline cursor-pointer"
                >
                  Restaurar factura ejemplo
                </button>
              </div>
              <textarea
                rows={6}
                value={rawInvoiceText}
                onChange={(e) => {
                  setUploadedFile(null);
                  setRawInvoiceText(e.target.value);
                }}
                className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        )}

        {/* Mode 2: Structured Payload & Fault Injection */}
        {inputMode === 'payload' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Escenarios de Prueba</p>
              {TEST_PRESETS.map((preset, idx) => (
                <button
                  key={preset.scenarioLabel}
                  type="button"
                  onClick={() => handleSelectPreset(idx)}
                  className={`w-full text-left px-3.5 py-2 rounded-md border text-xs transition-colors cursor-pointer ${
                    payload.scenarioLabel === preset.scenarioLabel
                      ? 'border-blue-700 bg-blue-50/50 text-slate-900 font-medium'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {preset.scenarioLabel}
                </button>
              ))}
            </div>

            <div className="lg:col-span-7 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">N.° Factura</span>
                  <input
                    type="text"
                    value={payload.invoiceNumber}
                    onChange={(e) => setPayload({ ...payload, invoiceNumber: e.target.value })}
                    className="mt-1 w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">NIT Proveedor</span>
                  <input
                    type="text"
                    value={payload.vendorNit}
                    onChange={(e) => setPayload({ ...payload, vendorNit: e.target.value })}
                    className="mt-1 w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">Orden de Compra</span>
                  <input
                    type="text"
                    value={payload.purchaseOrder}
                    onChange={(e) => setPayload({ ...payload, purchaseOrder: e.target.value })}
                    className="mt-1 w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">Valor (COP)</span>
                  <input
                    type="number"
                    value={payload.amount}
                    onChange={(e) => setPayload({ ...payload, amount: Number(e.target.value) || 0 })}
                    className="mt-1 w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payload.simulateTransientError}
                    onChange={(e) =>
                      setPayload({ ...payload, simulateTransientError: e.target.checked })
                    }
                    className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />
                  <span>Inyectar fallo HTTP 503 (prueba reintento real)</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payload.corruptedPayload}
                    onChange={(e) => setPayload({ ...payload, corruptedPayload: e.target.checked })}
                    className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />
                  <span>Inyectar XML corrupto (HTTP 422)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Mode 3: Real Inbound & Outbound Webhooks + HMAC-SHA256 */}
        {inputMode === 'webhook' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5">
                  <Webhook className="w-4 h-4 text-blue-700" />
                  Webhook Entrante Público (Node-RED / Postman / cURL)
                </span>
                <button
                  type="button"
                  onClick={handleCopyCurl}
                  className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline cursor-pointer"
                >
                  {copiedCurl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCurl ? 'Copiado' : 'Copiar cURL'}</span>
                </button>
              </div>
              <p className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-md px-3 py-2 break-all text-slate-800">
                POST {inboundWebhookUrl}
              </p>
              <pre className="text-[11px] font-mono bg-slate-900 text-slate-100 p-3 rounded-md overflow-x-auto">
                {curlCommand}
              </pre>

              <div className="pt-1 space-y-2">
                <p className="text-[11px] font-medium text-slate-600">
                  Verificación en vivo de firma criptográfica (X-Webhook-Signature):
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleTestWebhook(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Probar sin firma (espera 401 si activa)</span>
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleTestWebhook(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Probar con firma HMAC válida (201)</span>
                  </button>
                </div>
                {webhookTestNotice && (
                  <p
                    className={`text-xs font-mono px-3 py-2 rounded-md border ${
                      webhookTestNotice.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    {webhookTestNotice.text}
                  </p>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="lg:col-span-6 space-y-3">
              <p className="text-xs font-semibold text-slate-800">
                Configuración de Notificación Saliente Real, Seguridad HMAC y Reglas
              </p>
              <label className="block">
                <span className="text-[11px] font-medium text-slate-600">
                  Correo de notificación (Gmail API)
                </span>
                <input
                  type="email"
                  value={localSettings.notificationEmail}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, notificationEmail: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-slate-600">
                  URL Webhook Saliente (Node-RED http in, Slack, Discord o Webhook.site — opcional)
                </span>
                <input
                  type="url"
                  placeholder="http://127.0.0.1:1880/facturas-notificacion"
                  value={localSettings.outboundWebhookUrl}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, outboundWebhookUrl: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">
                    Tolerancia máx. vs OC (%)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={localSettings.tolerancePercent}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        tolerancePercent: Number(e.target.value) || 0,
                      })
                    }
                    className="mt-1 w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-md"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">
                    Confianza mínima IA (0–1)
                  </span>
                  <input
                    type="number"
                    min={0.1}
                    max={0.99}
                    step={0.05}
                    value={localSettings.minAiConfidence}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        minAiConfidence: Number(e.target.value) || 0.85,
                      })
                    }
                    className="mt-1 w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-md"
                  />
                </label>
              </div>
              <div className="border border-slate-200 rounded-md bg-slate-50/70 p-3 space-y-2.5">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.requireHmacHeader}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, requireHmacHeader: e.target.checked })
                    }
                    className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />
                  <span>Exigir firma HMAC-SHA256 en cabecera X-Webhook-Signature</span>
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">
                    Secreto compartido HMAC-SHA256
                  </span>
                  <input
                    type="text"
                    value={localSettings.hmacSecret}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, hmacSecret: e.target.value })
                    }
                    className="mt-1 w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
                >
                  Guardar Parámetros
                </button>
                {settingsSavedMsg && (
                  <span className="text-xs text-emerald-700 font-medium">{settingsSavedMsg}</span>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Mode 4: Real Gmail Inbox Reader (End-to-End Email Trigger) */}
        {inputMode === 'gmail' && (
          <div className="space-y-4">
            {!googleToken ? (
              <div className="border border-slate-200 rounded-md bg-slate-50 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-blue-700" />
                    Lectura directa de facturas desde tu bandeja de Gmail
                  </p>
                  <p className="text-xs text-slate-600">
                    Conecta tu cuenta de Google en el panel superior para listar correos reales, extraer adjuntos (PDF, XML, imagen) o texto y ejecutarlos en el flujo automatizado.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  disabled={isLoggingIn}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 whitespace-nowrap cursor-pointer shrink-0"
                >
                  {isLoggingIn ? 'Conectando…' : 'Conectar Google'}
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={gmailQuery}
                      onChange={(e) => setGmailQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          fetchGmailInbox();
                        }
                      }}
                      placeholder="Filtro de búsqueda Gmail (ej. factura, OC-2026, has:attachment)"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fetchGmailInbox()}
                      disabled={loadingInbox}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingInbox ? 'animate-spin' : ''}`} />
                      <span>{loadingInbox ? 'Consultando…' : 'Buscar en Gmail'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGmailQuery('');
                        fetchGmailInbox('');
                      }}
                      disabled={loadingInbox}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                    >
                      Ver recientes
                    </button>
                  </div>
                </div>

                {inboxError && (
                  <div className="p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-md">
                    {inboxError}
                  </div>
                )}

                {inboxMessages.length === 0 && !loadingInbox ? (
                  <div className="border border-slate-200 rounded-md p-6 text-center text-xs text-slate-500">
                    No se encontraron mensajes para el filtro actual. Prueba con «Ver recientes» o envía un correo de prueba con datos de factura.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-md divide-y divide-slate-200 max-h-[300px] overflow-y-auto">
                    {inboxMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {msg.subject}
                            </span>
                            {msg.hasAttachment && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-700">
                                <Paperclip className="w-3 h-3" />
                                {msg.attachmentName}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            De: {msg.from} {msg.date ? `· ${msg.date}` : ''}
                          </p>
                          <p className="text-xs text-slate-600 line-clamp-1">{msg.snippet}</p>
                        </div>
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => handleProcessGmailMessage(msg)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          <span>
                            {processingMessageId === msg.id ? 'Procesando…' : 'Procesar en flujo'}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Interactive Node Workflow Canvas */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Figura 2 · Ejecución Paso a Paso del Flujo (Haga clic en un nodo para ver su traza JSON)
          </h2>
          {lastTrace && (
            <div className="flex items-center gap-3 text-xs font-mono text-slate-600 tabular-nums">
              <span>Corrida: {lastTrace.id}</span>
              <span aria-hidden="true">·</span>
              <span>{lastTrace.totalDurationMs} ms</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  lastTrace.finalOutcome === 'Causada en ERP'
                    ? 'text-emerald-700 font-semibold'
                    : 'text-red-700 font-semibold'
                }
              >
                {lastTrace.finalOutcome}
              </span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-md bg-slate-50/70 p-4">
          <div className="relative min-w-[1160px] h-[335px]">
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 1360 335"
              preserveAspectRatio="none"
            >
              <path d="M 225 162 C 245 162, 240 162, 260 162" stroke="#64748B" strokeWidth="2" fill="none" />
              <path d="M 445 162 C 465 162, 460 162, 480 162" stroke="#64748B" strokeWidth="2" fill="none" />
              <path d="M 665 162 C 685 162, 680 162, 700 162" stroke="#64748B" strokeWidth="2" fill="none" />
              <path d="M 885 148 C 910 148, 905 88, 930 88" stroke="#15803D" strokeWidth="2" fill="none" />
              <path d="M 1115 88 C 1135 88, 1130 88, 1150 88" stroke="#15803D" strokeWidth="2" fill="none" />
              <path
                d="M 885 176 C 910 176, 905 256, 930 256"
                stroke="#B91C1C"
                strokeWidth="2"
                strokeDasharray="5 4"
                fill="none"
              />
            </svg>

            {WORKFLOW_NODES.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedNodeId(node.id)}
                style={{ left: `${node.x}px`, top: `${node.y}px`, width: '185px' }}
                className={`absolute text-left p-3 rounded-lg border transition-all cursor-pointer ${getNodeBorderStyle(
                  node.id
                )}`}
              >
                <div className="mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    {node.type === 'trigger'
                      ? 'Trigger'
                      : node.type === 'ai'
                      ? 'OCR / IA'
                      : node.type === 'http'
                      ? 'HTTP API'
                      : node.type === 'decision'
                      ? 'Regla IF'
                      : node.type === 'erp'
                      ? 'ERP / Salida'
                      : 'Excepción'}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-900 leading-snug">{node.title}</p>
                <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                  {node.subtitle}
                </p>
                <div className="mt-2 pt-1.5 border-t border-slate-100">
                  {renderStateLabel(node.id)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Node Inspector + Live Operational Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Node Inspector */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
            <div>
              <p className="text-xs font-medium text-slate-500">Inspector de Ejecución Real</p>
              <h3 className="text-base font-semibold text-slate-900 mt-0.5">{selectedNode.title}</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">{selectedNode.n8nNodeType}</span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">{selectedNode.description}</p>

          {selectedStepTrace ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Salida del nodo en la última ejecución</span>
                <span className="font-mono text-slate-500 tabular-nums">
                  HTTP {selectedStepTrace.httpStatus ?? 200} · {selectedStepTrace.durationMs} ms
                </span>
              </div>
              <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-3">
                {selectedStepTrace.summary}
              </p>
              {selectedStepTrace.responsePayload !== undefined && (
                <pre className="text-[11px] font-mono bg-slate-900 text-slate-100 p-3 rounded-md overflow-x-auto max-h-56">
                  {JSON.stringify(selectedStepTrace.responsePayload, null, 2)}
                </pre>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-4 flex items-center gap-2.5">
              <RotateCcw className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Ejecute una factura real o un escenario de prueba para inspeccionar la salida JSON de este nodo.
              </span>
            </div>
          )}
        </div>

        {/* Live Persistent Operations: Quarantine HITL / ERP Ledger / Purchase Orders */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setOpsTab('quarantine')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  opsTab === 'quarantine'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cuarentena HITL ({pendingQuarantineCount} pendientes)
              </button>
              <button
                type="button"
                onClick={() => setOpsTab('erp')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  opsTab === 'erp'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Libro ERP ({erpEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setOpsTab('pos')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  opsTab === 'pos'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Órdenes de Compra ({purchaseOrders.length})
              </button>
            </div>
            <Server className="w-4 h-4 text-slate-400" />
          </div>

          {opsTab === 'quarantine' && (
            <div className="space-y-3 max-h-[380px] overflow-y-auto">
              {quarantineQueue.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">
                  No existen facturas en cola de cuarentena.
                </p>
              ) : (
                quarantineQueue.map((item) => (
                  <div
                    key={item.id}
                    className="border border-slate-200 rounded-md p-3.5 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-slate-900">
                        {item.id} · {item.invoiceNumber}
                      </span>
                      <span className="font-mono text-slate-800 tabular-nums">
                        ${item.amount.toLocaleString('es-CO')} COP
                      </span>
                    </div>
                    <p className="text-slate-600">
                      <ShieldAlert className="w-3.5 h-3.5 inline mr-1 text-red-700" />
                      <span className="font-mono text-[11px] text-red-800 mr-1.5">
                        [{item.reasonCode}]
                      </span>
                      {item.reasonMessage}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-slate-500">
                        {item.vendorName} · OC: {item.purchaseOrder || 'N/A'}
                      </span>
                      {item.status === 'pending' ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleResolveQuarantine(item.id, 'approved')}
                            className="px-2.5 py-1 text-[11px] font-medium text-white bg-emerald-700 rounded hover:bg-emerald-800 cursor-pointer"
                          >
                            Aprobar y Causar en ERP
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveQuarantine(item.id, 'rejected')}
                            className="px-2.5 py-1 text-[11px] font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 cursor-pointer"
                          >
                            Rechazar
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`text-[11px] font-semibold ${
                            item.status === 'approved' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {item.status === 'approved'
                            ? 'Resuelto: Aprobada y causada en ERP'
                            : 'Resuelto: Rechazada'}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {opsTab === 'erp' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  Asientos contables causados listos para conciliación o importación en ERP.
                </p>
                <button
                  type="button"
                  onClick={handleExportErpCsv}
                  disabled={erpEntries.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar CSV Contable</span>
                </button>
              </div>
              <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
                {erpEntries.map((entry) => (
                  <div key={entry.entryId} className="py-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-slate-900">
                        {entry.entryId}
                        {entry.approvedManually ? ' (HITL)' : ''}
                      </span>
                      <span className="font-mono text-emerald-700 font-semibold tabular-nums">
                        Neto: ${entry.netPayable.toLocaleString('es-CO')} COP
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>
                        {entry.invoiceNumber} · {entry.purchaseOrder} · {entry.glAccount}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">{entry.costCenter}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {entry.vendorName} · Retefuente: ${entry.withholdingTax.toLocaleString('es-CO')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {opsTab === 'pos' && (
            <div className="space-y-4">
              <form onSubmit={handleCreatePo} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 border border-slate-200 p-3 rounded-md">
                <input
                  type="text"
                  placeholder="N.° OC (ej. OC-2026-4600)"
                  value={newPo.poNumber}
                  onChange={(e) => setNewPo({ ...newPo, poNumber: e.target.value })}
                  className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  placeholder="Proveedor"
                  value={newPo.vendorName}
                  onChange={(e) => setNewPo({ ...newPo, vendorName: e.target.value })}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  placeholder="NIT (ej. 901555321-4)"
                  value={newPo.vendorNit}
                  onChange={(e) => setNewPo({ ...newPo, vendorNit: e.target.value })}
                  className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded"
                />
                <input
                  type="number"
                  placeholder="Monto autorizado"
                  value={newPo.authorizedAmount}
                  onChange={(e) => setNewPo({ ...newPo, authorizedAmount: Number(e.target.value) || 0 })}
                  className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded"
                />
                <input
                  type="text"
                  placeholder="Centro costo"
                  value={newPo.costCenter}
                  onChange={(e) => setNewPo({ ...newPo, costCenter: e.target.value })}
                  className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded hover:bg-blue-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar OC</span>
                </button>
                {poError && <p className="sm:col-span-3 text-xs text-red-700">{poError}</p>}
              </form>

              <div className="divide-y divide-slate-100 max-h-[240px] overflow-y-auto text-xs">
                {purchaseOrders.map((po) => (
                  <div key={po.poNumber} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-slate-900">
                        {po.poNumber} · NIT {po.vendorNit}
                      </p>
                      <p className="text-slate-600 truncate">
                        {po.vendorName} · {po.costCenter} · {po.glAccount}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        ${po.authorizedAmount.toLocaleString('es-CO')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeletePo(po.poNumber)}
                        className="p-1 text-slate-400 hover:text-red-700 cursor-pointer"
                        aria-label={`Eliminar ${po.poNumber}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <EmailConfirmationModal
        draft={pendingEmailDraft}
        sending={sendingGmail}
        errorMessage={gmailError}
        onCancel={() => setPendingEmailDraft(null)}
        onConfirm={handleConfirmSendGmail}
      />
    </div>
  );
};
