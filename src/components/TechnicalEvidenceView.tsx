import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { ExecutionLog } from '../types/automation';

interface TechnicalEvidenceViewProps {
  logs: ExecutionLog[];
  onResetLogs: () => void;
  onGoToPrototype: () => void;
}

export const TechnicalEvidenceView: React.FC<TechnicalEvidenceViewProps> = ({
  logs,
  onResetLogs,
  onGoToPrototype,
}) => {
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(logs[0]?.id ?? null);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'success') return log.scenarioType !== 'controlled_error';
    if (filter === 'error') return log.scenarioType === 'controlled_error';
    return true;
  });

  const totalRuns = logs.length;
  const erpSuccessRuns = logs.filter((l) => l.finalOutcome === 'Causada en ERP').length;
  const hitlQuarantineRuns = totalRuns - erpSuccessRuns;
  const autoRatePct = totalRuns > 0 ? (erpSuccessRuns / totalRuns) * 100 : 0;
  const hitlRatePct = totalRuns > 0 ? (hitlQuarantineRuns / totalRuns) * 100 : 0;
  const avgLatencyMs =
    totalRuns > 0
      ? Math.round(logs.reduce((acc, l) => acc + l.totalDurationMs, 0) / totalRuns)
      : 0;
  const confidenceSamples = logs
    .map((l) => l.aiConfidence)
    .filter((c): c is number => typeof c === 'number' && !Number.isNaN(c));
  const avgConfidencePct =
    confidenceSamples.length > 0
      ? (confidenceSamples.reduce((acc, c) => acc + c, 0) / confidenceSamples.length) * 100
      : null;

  const handleExportCsv = () => {
    const headers = [
      'ID_Ejecucion',
      'Fecha_ISO',
      'Origen',
      'Escenario',
      'Tipo',
      'Factura',
      'Proveedor',
      'Monto_COP',
      'Confianza_IA',
      'Duracion_ms',
      'Resultado_Final',
    ];
    const rows = logs.map((l) => [
      l.id,
      l.timestamp,
      l.source,
      `"${l.scenarioLabel.replace(/"/g, '""')}"`,
      l.scenarioType,
      l.invoiceNumber,
      `"${l.vendorName.replace(/"/g, '""')}"`,
      l.amount,
      typeof l.aiConfidence === 'number' ? l.aiConfidence.toFixed(2) : '',
      l.totalDurationMs,
      `"${l.finalOutcome}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'registro_pruebas_prototipo.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Evidencias Técnicas · Validación Funcional y Observabilidad
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">
              Registro de Pruebas del Prototipo (Escenarios Exitosos y Errores Controlados)
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
            <button
              type="button"
              onClick={onResetLogs}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Restaurar base</span>
            </button>
            <button
              type="button"
              onClick={onGoToPrototype}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Nueva Prueba</span>
            </button>
          </div>
        </div>

        {/* Observability & AI Confidence Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-slate-200 rounded-md p-3.5 bg-slate-50/50">
            <p className="text-[11px] font-medium text-slate-500">Total de Ejecuciones</p>
            <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {totalRuns}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {erpSuccessRuns} ERP · {hitlQuarantineRuns} Cuarentena HITL
            </p>
          </div>
          <div className="border border-slate-200 rounded-md p-3.5 bg-slate-50/50">
            <p className="text-[11px] font-medium text-slate-500">Tasa de Causación Automática</p>
            <p className="text-xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
              {autoRatePct.toFixed(1)}%
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              Contención HITL: {hitlRatePct.toFixed(1)}%
            </p>
          </div>
          <div className="border border-slate-200 rounded-md p-3.5 bg-slate-50/50">
            <p className="text-[11px] font-medium text-slate-500">Latencia Promedio del Flujo</p>
            <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {avgLatencyMs} ms
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Incluye OCR, API tributaria y notificación
            </p>
          </div>
          <div className="border border-slate-200 rounded-md p-3.5 bg-slate-50/50">
            <p className="text-[11px] font-medium text-slate-500">Confianza Media OCR / IA</p>
            <p className="text-xl font-bold text-blue-700 font-mono tabular-nums mt-1">
              {avgConfidencePct !== null ? `${avgConfidencePct.toFixed(1)}%` : 'N/D'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              Muestras medidas: {confidenceSamples.length} de {totalRuns}
            </p>
          </div>
        </div>

        {/* Filter segmented tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('success')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filter === 'success'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Exitosos / Recuperados (
              {logs.filter((l) => l.scenarioType !== 'controlled_error').length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('error')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filter === 'error'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Error Controlado ({logs.filter((l) => l.scenarioType === 'controlled_error').length})
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Haga clic en cualquier ejecución para desplegar la traza nodo a nodo.
          </p>
        </div>

        {/* Execution Log Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                <th className="py-3 px-4">ID Ejecución</th>
                <th className="py-3 px-4">Escenario evaluado</th>
                <th className="py-3 px-4">Factura</th>
                <th className="py-3 px-4 text-right">Valor (COP)</th>
                <th className="py-3 px-4 text-right">Duración</th>
                <th className="py-3 px-4">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const isExpanded = expandedId === log.id;
                const isError = log.scenarioType === 'controlled_error';
                return (
                  <React.Fragment key={log.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          {log.id}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium">{log.scenarioLabel}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {log.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-right text-slate-800 tabular-nums whitespace-nowrap">
                        ${log.amount.toLocaleString('es-CO')}
                      </td>
                      <td className="py-3 px-4 font-mono text-right text-slate-600 tabular-nums whitespace-nowrap">
                        {log.totalDurationMs} ms
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isError ? (
                          <span className="inline-flex items-center gap-1.5 text-red-700 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{log.finalOutcome}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{log.finalOutcome}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={6} className="p-4 border-t border-slate-200">
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>
                                Proveedor: <strong className="text-slate-800">{log.vendorName}</strong>
                              </span>
                              <span className="font-mono tabular-nums">
                                Marca temporal: {new Date(log.timestamp).toLocaleString('es-CO')}
                              </span>
                            </div>
                            <div className="divide-y divide-slate-200 border border-slate-200 rounded-md bg-white">
                              {log.steps.map((step, index) => (
                                <div
                                  key={`${log.id}-${step.nodeId}-${index}`}
                                  className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                                >
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                                        {String(index + 1).padStart(2, '0')}.
                                      </span>
                                      <span className="font-semibold text-slate-900">
                                        {step.nodeName}
                                      </span>
                                      {step.httpStatus && (
                                        <span className="font-mono text-[11px] text-slate-500">
                                          HTTP {step.httpStatus}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-600 pl-6">{step.summary}</p>
                                  </div>
                                  <div className="flex items-center gap-3 pl-6 sm:pl-0 shrink-0">
                                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                                      {step.durationMs} ms
                                    </span>
                                    <span
                                      className={`text-[11px] font-medium ${
                                        step.status === 'success'
                                          ? 'text-emerald-700'
                                          : step.status === 'retry'
                                          ? 'text-amber-700'
                                          : 'text-red-700'
                                      }`}
                                    >
                                      {step.status === 'success'
                                        ? 'OK'
                                        : step.status === 'retry'
                                        ? 'Reintento'
                                        : 'Error controlado'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
