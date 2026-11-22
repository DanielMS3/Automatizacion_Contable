export type ActiveSection =
  | 'process'
  | 'prototype'
  | 'bpmn'
  | 'evidence'
  | 'report'
  | 'presentation';

export interface StudentMetadata {
  courseName: string;
  projectTitle: string;
  studentName: string;
  institution: string;
  date: string;
  youtubeUrl: string;
}

export interface RoiParameters {
  monthlyInvoices: number;
  manualMinutesPerInvoice: number;
  automatedMinutesPerInvoice: number;
  analystHourlyCostCop: number;
  manualErrorRatePercent: number;
  errorReworkCostCop: number;
}

export interface PurchaseOrder {
  poNumber: string;
  vendorName: string;
  vendorNit: string;
  authorizedAmount: number;
  costCenter: string;
  glAccount: string;
}

export interface ErpEntry {
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

export interface QuarantineItem {
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

export interface WorkflowSettings {
  outboundWebhookUrl: string;
  notificationEmail: string;
  tolerancePercent: number;
  minAiConfidence: number;
  requireHmacHeader: boolean;
  hmacSecret: string;
}

export interface StepTrace {
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

export interface ExecutionLog {
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

export interface WorkflowNodeDefinition {
  id: string;
  title: string;
  subtitle: string;
  type: 'trigger' | 'ai' | 'http' | 'decision' | 'erp' | 'error';
  x: number;
  y: number;
  n8nNodeType: string;
  retryPolicy: string;
  description: string;
  endpoint?: string;
}

export interface InvoiceTestPayload {
  scenarioLabel: string;
  invoiceNumber: string;
  vendorName: string;
  vendorNit: string;
  purchaseOrder: string;
  amount: number;
  simulateTransientError: boolean;
  corruptedPayload: boolean;
}

export interface GmailInboxMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  hasAttachment: boolean;
  attachmentName?: string;
}

export interface ReportFigureScreenshots {
  nodeRedDataUrl: string;
  gmailDataUrl: string;
}
