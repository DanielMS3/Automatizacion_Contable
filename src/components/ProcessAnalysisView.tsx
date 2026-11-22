import React from 'react';
import { RoiParameters } from '../types/automation';

interface ProcessAnalysisViewProps {
  roi: RoiParameters;
  onUpdateRoi: (next: RoiParameters) => void;
  onNavigateToPrototype: () => void;
}

export const ProcessAnalysisView: React.FC<ProcessAnalysisViewProps> = ({
  roi,
  onUpdateRoi,
  onNavigateToPrototype,
}) => {
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
  const monthlyErrorsAuto = monthlyErrorsManual * 0.08;
  const reworkSavingsMonth = (monthlyErrorsManual - monthlyErrorsAuto) * roi.errorReworkCostCop;
  const laborSavingsMonth = hoursSavedMonth * roi.analystHourlyCostCop;
  const totalMonthlySavingsCop = laborSavingsMonth + reworkSavingsMonth;
  const annualSavingsCop = totalMonthlySavingsCop * 12;

  const formatCop = (value: number) =>
    `$${Math.round(value).toLocaleString('es-CO')} COP`;

  return (
    <div className="space-y-8">
      {/* Intro & Process Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="max-w-3xl space-y-2">
            <p className="text-xs font-medium text-slate-500">
              Proceso Seleccionado · Área Financiera y Contable
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-balance">
              Recepción, Validación Tributaria y Causación Contable de Facturas Electrónicas
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Proceso operativo de alto volumen encargado de recibir comprobantes fiscales de proveedores,
              verificar su validez tributaria y su concordancia con órdenes de compra aprobadas,
              clasificar el gasto contable y registrar la obligación de pago en el sistema ERP corporativo.
            </p>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              onClick={onNavigateToPrototype}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Abrir Prototipo Node-RED
            </button>
          </div>
        </div>

        {/* Clean 4-column unboxed KPI strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6 pt-6 border-t border-slate-200">
          <div>
            <p className="text-xs text-slate-500">Tiempo manual promedio (AS-IS)</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {roi.manualMinutesPerInvoice} min/fact.
            </p>
            <p className="text-xs text-slate-500 mt-1">Lectura, cruce y digitación en ERP</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Tiempo automatizado (TO-BE)</p>
            <p className="text-2xl font-bold text-blue-700 tabular-nums mt-1">
              {roi.automatedMinutesPerInvoice} min/fact.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Reducción operativa del {timeReductionPct.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Horas liberadas al mes</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {hoursSavedMonth.toFixed(1)} h/mes
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Base de {roi.monthlyInvoices.toLocaleString('es-CO')} facturas mensuales
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Ahorro anual estimado</p>
            <p className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">
              {formatCop(annualSavingsCop)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Horas operativas y reducción de retrabajo</p>
          </div>
        </div>
      </div>

      {/* 4-Quadrant Characterization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            1. Entradas y Salidas del Proceso
          </h2>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="pb-3 border-b border-slate-100">
              <p className="font-medium text-slate-900">Entradas (Inputs)</p>
              <ul className="mt-1.5 space-y-1 list-disc list-inside text-slate-600">
                <li>Archivos XML (estándar UBL 2.1) y representación gráfica PDF remitidos por proveedores.</li>
                <li>Registro maestro de Órdenes de Compra (OC) aprobadas y centros de costo.</li>
                <li>Catálogo tributario vigente y estado fiscal del emisor (NIT y CUFE).</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-900">Salidas (Outputs)</p>
              <ul className="mt-1.5 space-y-1 list-disc list-inside text-slate-600">
                <li>Asiento contable causado en el libro mayor del ERP con cálculo de retenciones.</li>
                <li>Notificación de confirmación a Tesorería para programación de giro.</li>
                <li>Registro en cola de cuarentena y alerta diagnóstica en caso de discrepancias.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            2. Actores Involucrados y Roles
          </h2>
          <div className="divide-y divide-slate-100 text-sm">
            <div className="py-2.5 flex items-start justify-between gap-4">
              <span className="font-medium text-slate-900 shrink-0">Proveedores externos</span>
              <span className="text-slate-600 text-right">
                Emiten factura electrónica con referencia de orden de compra.
              </span>
            </div>
            <div className="py-2.5 flex items-start justify-between gap-4">
              <span className="font-medium text-slate-900 shrink-0">Orquestador Node-RED / RPA</span>
              <span className="text-slate-600 text-right">
                Ingesta, extracción OCR/IA, validación contra API y registro en ERP.
              </span>
            </div>
            <div className="py-2.5 flex items-start justify-between gap-4">
              <span className="font-medium text-slate-900 shrink-0">Analista contable</span>
              <span className="text-slate-600 text-right">
                Supervisa excepciones en cuarentena y valida casos fuera de tolerancia.
              </span>
            </div>
            <div className="py-2.5 flex items-start justify-between gap-4">
              <span className="font-medium text-slate-900 shrink-0">Gerencia financiera / Tesorería</span>
              <span className="text-slate-600 text-right">
                Aprueba sobrecostos extraordinarios y ejecuta el calendario de pagos.
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            3. Dependencias y Puntos de Decisión
          </h2>
          <div className="space-y-3 text-sm text-slate-600">
            <div>
              <p className="font-medium text-slate-900">Dependencias críticas</p>
              <p className="mt-1 leading-relaxed">
                Disponibilidad de la API de validación fiscal, integridad sintáctica del documento XML,
                existencia previa de una Orden de Compra aprobada y conectividad con el endpoint contable del ERP.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100">
              <p className="font-medium text-slate-900">Puntos de decisión (Compuertas lógicas)</p>
              <ul className="mt-1.5 space-y-1 list-disc list-inside">
                <li>¿El archivo XML/PDF es legible y supera el umbral de confianza OCR (≥ 0.90)?</li>
                <li>¿El NIT del emisor coincide con el titular registrado en la Orden de Compra?</li>
                <li>¿La desviación del valor facturado respecto a la OC es ≤ 5% de tolerancia?</li>
                <li>¿La factura no ha sido causada previamente (control de idempotencia HTTP 409)?</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            4. Dolor Actual (Diagnóstico AS-IS)
          </h2>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-start justify-between gap-4 pb-2.5 border-b border-slate-100">
              <div>
                <p className="font-medium text-slate-900">Tiempo excesivo de ciclo</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Revisión manual de correos, descarga de adjuntos y transcripción línea por línea.
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums shrink-0">
                135 h/mes
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 pb-2.5 border-b border-slate-100">
              <div>
                <p className="font-medium text-slate-900">Tasa de error humano</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Errores en dígitos del NIT, cálculo de retenciones o selección de centro de costo.
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-amber-700 tabular-nums shrink-0">
                7.4% retrabajo
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900">Riesgo de duplicidad y mora</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pérdida de descuentos por pronto pago y retrasos en cierres contables mensuales.
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-red-700 tabular-nums shrink-0">
                Alto impacto
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive ROI Parameters */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Simulador de Impacto Operativo y Retorno
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ajuste las variables operativas del caso de estudio para recalcular automáticamente las cifras del informe.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            Ahorro mensual neto: {formatCop(totalMonthlySavingsCop)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">Volumen mensual de facturas</span>
            <input
              type="number"
              min={50}
              max={10000}
              step={10}
              value={roi.monthlyInvoices}
              onChange={(e) =>
                onUpdateRoi({ ...roi, monthlyInvoices: Math.max(1, Number(e.target.value) || 0) })
              }
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">Tiempo manual por factura (min)</span>
            <input
              type="number"
              min={1}
              max={120}
              step={1}
              value={roi.manualMinutesPerInvoice}
              onChange={(e) =>
                onUpdateRoi({
                  ...roi,
                  manualMinutesPerInvoice: Math.max(1, Number(e.target.value) || 1),
                })
              }
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">Tiempo con automatización (min)</span>
            <input
              type="number"
              min={0.1}
              max={30}
              step={0.1}
              value={roi.automatedMinutesPerInvoice}
              onChange={(e) =>
                onUpdateRoi({
                  ...roi,
                  automatedMinutesPerInvoice: Math.max(0.1, Number(e.target.value) || 0.1),
                })
              }
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">Costo hora analista contable (COP)</span>
            <input
              type="number"
              min={5000}
              max={300000}
              step={1000}
              value={roi.analystHourlyCostCop}
              onChange={(e) =>
                onUpdateRoi({
                  ...roi,
                  analystHourlyCostCop: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">Tasa de error manual (%)</span>
            <input
              type="number"
              min={0}
              max={50}
              step={0.1}
              value={roi.manualErrorRatePercent}
              onChange={(e) =>
                onUpdateRoi({
                  ...roi,
                  manualErrorRatePercent: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">Costo unitario por reproceso (COP)</span>
            <input
              type="number"
              min={0}
              max={500000}
              step={1000}
              value={roi.errorReworkCostCop}
              onChange={(e) =>
                onUpdateRoi({
                  ...roi,
                  errorReworkCostCop: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
