import React, { useMemo, useRef, useState } from 'react';
import { Download, ImagePlus, Printer, Trash2 } from 'lucide-react';
import { BpmnDiagramSvg } from './BpmnDiagramSvg';
import {
  APA_REFERENCES,
  RISK_MATRIX,
  TECHNOLOGY_COMPARISON,
  WORKFLOW_NODES,
} from '../data/projectContent';
import { generateAndDownloadApaPdf } from '../lib/apaPdfGenerator';
import {
  ExecutionLog,
  ReportFigureScreenshots,
  RoiParameters,
  StudentMetadata,
} from '../types/automation';

const STORAGE_SCREENSHOTS_KEY = 'custodios_report_screenshots_v1';

interface AcademicReportViewProps {
  metadata: StudentMetadata;
  onUpdateMetadata: (next: StudentMetadata) => void;
  roi: RoiParameters;
  logs: ExecutionLog[];
}

export const AcademicReportView: React.FC<AcademicReportViewProps> = ({
  metadata,
  onUpdateMetadata,
  roi,
  logs,
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
  const reworkSavingsMonth = (monthlyErrorsManual - monthlyErrorsManual * 0.08) * roi.errorReworkCostCop;
  const laborSavingsMonth = hoursSavedMonth * roi.analystHourlyCostCop;
  const totalMonthlySavingsCop = laborSavingsMonth + reworkSavingsMonth;
  const annualSavingsCop = totalMonthlySavingsCop * 12;

  const successLog = useMemo(
    () => logs.find((l) => l.scenarioType !== 'controlled_error') ?? logs[0],
    [logs]
  );
  const errorLog = useMemo(
    () => logs.find((l) => l.scenarioType === 'controlled_error') ?? logs[1],
    [logs]
  );

  const nodeRedInputRef = useRef<HTMLInputElement | null>(null);
  const gmailInputRef = useRef<HTMLInputElement | null>(null);
  const bpmnSvgRef = useRef<SVGSVGElement | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);
  const [pdfFeedback, setPdfFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [screenshots, setScreenshots] = useState<ReportFigureScreenshots>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SCREENSHOTS_KEY);
      return saved
        ? { nodeRedDataUrl: '', gmailDataUrl: '', ...JSON.parse(saved) }
        : { nodeRedDataUrl: '', gmailDataUrl: '' };
    } catch {
      return { nodeRedDataUrl: '', gmailDataUrl: '' };
    }
  });

  const saveScreenshots = (next: ReportFigureScreenshots) => {
    setScreenshots(next);
    try {
      localStorage.setItem(STORAGE_SCREENSHOTS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  };

  const handleUploadScreenshot = (
    slot: keyof ReportFigureScreenshots,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        saveScreenshots({ ...screenshots, [slot]: reader.result });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDownloadPdf = async () => {
    if (generatingPdf) return;
    setGeneratingPdf(true);
    setPdfFeedback(null);
    try {
      const result = await generateAndDownloadApaPdf({
        metadata,
        roi,
        logs,
        screenshots,
        bpmnSvgElement: bpmnSvgRef.current,
      });
      setPdfFeedback({
        ok: true,
        text: `Descargado ${result.fileName} (${result.totalPages} páginas totales; ${result.bodyPages} páginas de cuerpo sin portada ni referencias).`,
      });
    } catch (err) {
      setPdfFeedback({
        ok: false,
        text:
          err instanceof Error
            ? `No fue posible generar el PDF: ${err.message}`
            : 'No fue posible generar el archivo PDF.',
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Editable Metadata & Print Controls (hidden when printing) */}
      <div className="no-print bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Documento Entregable · Normas APA (7.ª ed.) · Extensión objetivo: 10–15 páginas
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">
              Estudio de Informe Escrito Individual y Descarga directa en PDF
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handlePrintPdf}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir vista</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{generatingPdf ? 'Generando PDF…' : 'Descargar PDF (APA 7.ª ed.)'}</span>
            </button>
          </div>
        </div>

        {pdfFeedback && (
          <div
            className={`px-3.5 py-2.5 text-xs rounded-md border ${
              pdfFeedback.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {pdfFeedback.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Nombre del estudiante</span>
            <input
              type="text"
              value={metadata.studentName}
              onChange={(e) => onUpdateMetadata({ ...metadata, studentName: e.target.value })}
              className="mt-1 w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Institución</span>
            <input
              type="text"
              value={metadata.institution}
              onChange={(e) => onUpdateMetadata({ ...metadata, institution: e.target.value })}
              className="mt-1 w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Curso</span>
            <input
              type="text"
              value={metadata.courseName}
              onChange={(e) => onUpdateMetadata({ ...metadata, courseName: e.target.value })}
              className="mt-1 w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-700">Título del proyecto</span>
            <input
              type="text"
              value={metadata.projectTitle}
              onChange={(e) => onUpdateMetadata({ ...metadata, projectTitle: e.target.value })}
              className="mt-1 w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Fecha de entrega</span>
            <input
              type="text"
              value={metadata.date}
              onChange={(e) => onUpdateMetadata({ ...metadata, date: e.target.value })}
              className="mt-1 w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className="text-xs font-medium text-slate-700">
              Enlace de presentación oral en YouTube (modo de visualización restringida / oculto)
            </span>
            <input
              type="url"
              value={metadata.youtubeUrl}
              onChange={(e) => onUpdateMetadata({ ...metadata, youtubeUrl: e.target.value })}
              className="mt-1 w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
        </div>

        {/* External Evidence Screenshot Slots (Node-RED & Gmail) */}
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-800">
              Capturas Externas de Evidencia (se integran en la Sección 6 del PDF en formato APA)
            </p>
            <p className="text-[11px] text-slate-500">
              Adjunte capturas reales (PNG/JPG) de su flujo ejecutándose en Node-RED y del correo recibido en Gmail para incluirlas como Figura 2 y Figura 3.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-md p-3 bg-slate-50/60 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">Figura 2 · Captura Node-RED</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {screenshots.nodeRedDataUrl
                    ? 'Imagen cargada lista para impresión PDF'
                    : 'Sin imagen adjunta (opcional)'}
                </p>
              </div>
              <input
                ref={nodeRedInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => handleUploadScreenshot('nodeRedDataUrl', e)}
                className="hidden"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => nodeRedInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>{screenshots.nodeRedDataUrl ? 'Cambiar' : 'Subir PNG/JPG'}</span>
                </button>
                {screenshots.nodeRedDataUrl && (
                  <button
                    type="button"
                    onClick={() => saveScreenshots({ ...screenshots, nodeRedDataUrl: '' })}
                    className="p-1.5 text-slate-400 hover:text-red-700 cursor-pointer"
                    aria-label="Quitar captura Node-RED"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="border border-slate-200 rounded-md p-3 bg-slate-50/60 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">Figura 3 · Captura Correo Gmail</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {screenshots.gmailDataUrl
                    ? 'Imagen cargada lista para impresión PDF'
                    : 'Sin imagen adjunta (opcional)'}
                </p>
              </div>
              <input
                ref={gmailInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => handleUploadScreenshot('gmailDataUrl', e)}
                className="hidden"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => gmailInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>{screenshots.gmailDataUrl ? 'Cambiar' : 'Subir PNG/JPG'}</span>
                </button>
                {screenshots.gmailDataUrl && (
                  <button
                    type="button"
                    onClick={() => saveScreenshots({ ...screenshots, gmailDataUrl: '' })}
                    className="p-1.5 text-slate-400 hover:text-red-700 cursor-pointer"
                    aria-label="Quitar captura Gmail"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          El botón «Descargar PDF (APA 7.ª ed.)» genera directamente un archivo PDF vectorial tamaño Carta con márgenes de 1 pulgada (2.54 cm), numeración superior derecha APA, tablas académicas, diagrama BPMN 2.0, trazas de ejecución y sangría francesa en referencias.
        </p>
      </div>

      {/* Printable APA 7th Ed. Manuscript */}
      <article className="print-only-container bg-white border border-slate-200 rounded-lg max-w-[850px] mx-auto p-10 sm:p-14 text-slate-900 leading-[1.85] text-[15px]">
        {/* PORTADA (Página 1) */}
        <section className="min-h-[780px] flex flex-col justify-between text-center py-12">
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-600">
              Actividad: Custodios de la Innovación — Forjando Conexiones Avanzadas
            </p>
          </div>

          <div className="space-y-6 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-900 leading-snug text-balance">
              {metadata.projectTitle}
            </h1>
            <div className="pt-6 space-y-2 text-base text-slate-800">
              <p className="font-medium">{metadata.studentName}</p>
              <p>{metadata.institution}</p>
              <p>{metadata.courseName}</p>
              <p className="pt-2 text-slate-600">{metadata.date}</p>
            </div>
          </div>

          <div className="text-xs text-slate-600 space-y-1 border-t border-slate-200 pt-6 max-w-xl mx-auto">
            <p className="font-semibold text-slate-800">
              Enlace de sustentación oral en video (YouTube — visualización restringida):
            </p>
            <p className="font-mono break-all text-blue-800">{metadata.youtubeUrl}</p>
          </div>
        </section>

        {/* SECCIÓN 1: INTRODUCCIÓN */}
        <section className="apa-page-break space-y-4">
          <h2 className="text-xl font-bold text-slate-900 text-center pb-2">
            {metadata.projectTitle}
          </h2>
          <h3 className="text-lg font-bold text-slate-900 pt-2">1. Introducción</h3>

          <h4 className="text-base font-bold text-slate-900">1.1 Contextualización del problema</h4>
          <p className="text-justify indent-8">
            En las organizaciones contemporáneas, la transformación digital ha dejado de ser una iniciativa
            accesoria para consolidarse como un imperativo de competitividad, trazabilidad y control interno.
            Sin embargo, múltiples áreas administrativas y financieras continúan operando bajo esquemas
            fragmentados en los cuales el talento humano invierte una proporción significativa de su jornada en
            tareas repetitivas de transcripción, validación documental y conciliación entre sistemas que no se
            comunican de manera nativa (Hammer &amp; Champy, 1993; vom Brocke &amp; Rosemann, 2015). Uno de los
            ejemplos más representativos de esta fricción operativa ocurre en la gestión de cuentas por pagar,
            específicamente durante la recepción, verificación tributaria y causación contable de facturas
            electrónicas emitidas por proveedores.
          </p>
          <p className="text-justify indent-8">
            Cuando dicho proceso se ejecuta manualmente, los analistas deben monitorear buzones de correo,
            descargar archivos XML y PDF, contrastar los montos facturados contra órdenes de compra aprobadas
            y digitar cada registro en el sistema de planificación de recursos empresariales (ERP). Este modo
            de operación introduce cuellos de botella en los cierres contables, incrementa la probabilidad de
            errores de digitación y expone a la entidad a causaciones duplicadas o a la pérdida de descuentos
            financieros por pronto pago.
          </p>

          <h4 className="text-base font-bold text-slate-900 pt-2">1.2 Justificación general del proyecto</h4>
          <p className="text-justify indent-8">
            La convergencia entre plataformas abiertas de orquestación Low-Code basada en flujos como
            Node-RED, la automatización robótica de procesos (RPA) y los modelos de inteligencia artificial
            aplicados al procesamiento documental ofrece un camino viable para modernizar flujos empresariales
            sin incurrir en reescrituras costosas de los sistemas centrales (van der Aalst et al., 2018;
            Davenport &amp; Ronanki, 2018). No obstante, el ejercicio de la ingeniería de software exige
            trascender el entusiasmo instrumental: implementar una automatización sin controles de
            idempotencia, sin manejo explícito de fallos de red ni evaluación ética sobre el impacto
            organizacional puede amplificar errores a escala industrial. Por ello, resulta indispensable
            diseñar soluciones que articulen rigor arquitectónico, observabilidad y responsabilidad
            profesional.
          </p>

          <h4 className="text-base font-bold text-slate-900 pt-2">1.3 Objetivos del trabajo</h4>
          <p className="text-justify indent-8">
            El objetivo general del presente proyecto consiste en analizar, diseñar y validar un prototipo
            funcional de automatización para el proceso de recepción, validación fiscal y causación contable
            de facturas electrónicas mediante orquestación Low-Code (Node-RED), integración de servicios API,
            RPA e inteligencia artificial aplicada, evaluando de manera crítica su impacto técnico, organizacional y
            ético. Como objetivos específicos se establecen: (a) caracterizar el proceso empresarial actual
            (AS-IS) identificando entradas, salidas, actores, dependencias y puntos de dolor; (b) modelar el
            flujo objetivo (TO-BE) bajo notación estándar BPMN 2.0; (c) implementar y probar un prototipo con
            manejo de errores e idempotencia ante escenarios exitosos y de fallo controlado; y (d) formular
            estrategias de mitigación de riesgos y lineamientos éticos de implementación.
          </p>
        </section>

        {/* SECCIÓN 2: DESCRIPCIÓN DEL PROCESO SELECCIONADO */}
        <section className="apa-page-break space-y-4">
          <h3 className="text-lg font-bold text-slate-900">2. Descripción del Proceso Seleccionado</h3>
          <p className="text-justify indent-8">
            El proceso seleccionado corresponde a la gestión integral de cuentas por pagar desde la recepción
            de la factura electrónica del proveedor hasta su causación definitiva en el libro auxiliar del ERP
            y la notificación a Tesorería. Siguiendo los lineamientos metodológicos para la identificación de
            procesos automatizables en transformación digital (vom Brocke &amp; Rosemann, 2015), este flujo
            presenta alto volumen transaccional, reglas de negocio explícitas y estructura documental
            estandarizable.
          </p>

          <h4 className="text-base font-bold text-slate-900 pt-1">2.1 Entradas y salidas</h4>
          <p className="text-justify indent-8">
            Las entradas principales del flujo comprenden: (a) el comprobante electrónico en formato XML
            (estándar UBL 2.1) acompañado de su representación gráfica en PDF; (b) la base maestra de
            órdenes de compra (OC) aprobadas con su respectivo centro de costo y cuenta contable asignada; y
            (c) los parámetros vigentes del registro tributario del emisor (NIT y Código Único de Factura
            Electrónica — CUFE). Como salidas resultantes se generan: (a) el asiento contable causado en el
            ERP con cálculo de retenciones aplicables y neto a pagar; (b) el aviso de confirmación hacia el
            área de Tesorería; o, en su defecto, (c) el aislamiento controlado del documento en cola de
            cuarentena acompañado de una alerta diagnóstica para revisión humana.
          </p>

          <h4 className="text-base font-bold text-slate-900 pt-1">2.2 Actores involucrados</h4>
          <p className="text-justify indent-8">
            En el ciclo operativo intervienen cuatro actores principales: el proveedor externo, responsable de
            emitir el documento tributario con referencia válida a la OC; el analista contable, encargado de
            conciliar los soportes y resolver excepciones; la gerencia financiera o de tesorería, encargada de
            autorizar desviaciones excepcionales y programar desembolsos; y el ecosistema tecnológico compuesto
            por el servicio de validación tributaria y el sistema ERP corporativo.
          </p>

          <h4 className="text-base font-bold text-slate-900 pt-1">2.3 Dependencias y puntos de decisión</h4>
          <p className="text-justify indent-8">
            La ejecución válida del proceso depende de la disponibilidad de los servicios de consulta fiscal,
            la integridad sintáctica del archivo XML adjunto, la existencia de una OC aprobada previamente y la
            conectividad con el módulo contable del ERP. Los puntos de decisión críticos son cuatro: verificar
            la legibilidad estructural del comprobante, confirmar que el NIT emisor coincida con el titular de
            la OC, validar que la diferencia entre el valor facturado y el monto autorizado en la OC no supere
            el umbral de tolerancia del 5%, y comprobar que el número de factura no haya sido causado
            previamente.
          </p>

          <h4 className="text-base font-bold text-slate-900 pt-1">2.4 Dolor actual en la operación manual</h4>
          <p className="text-justify indent-8">
            Bajo el esquema manual actual (AS-IS), para un volumen operativo de{' '}
            <span className="tabular-nums font-medium">{roi.monthlyInvoices.toLocaleString('es-CO')}</span>{' '}
            facturas mensuales, cada documento demanda en promedio{' '}
            <span className="tabular-nums font-medium">{roi.manualMinutesPerInvoice} minutos</span> de
            atención continua, lo cual equivale a{' '}
            <span className="tabular-nums font-medium">{manualHoursMonth.toFixed(1)} horas-hombre</span> al
            mes dedicadas a verificación y captura repetitiva. Adicionalmente, la tasa histórica de errores de
            digitación o conciliación se sitúa en{' '}
            <span className="tabular-nums font-medium">{roi.manualErrorRatePercent}%</span>, generando
            reprocesos contables, retrasos en cierres mensuales y exposición a sanciones o pérdida de
            descuentos comerciales.
          </p>
        </section>

        {/* SECCIÓN 3: JUSTIFICACIÓN DE LA AUTOMATIZACIÓN */}
        <section className="apa-page-break space-y-4">
          <h3 className="text-lg font-bold text-slate-900">3. Justificación de la Automatización</h3>
          <p className="text-justify indent-8">
            Desde una perspectiva de ingeniería de procesos, la automatización se justifica cuando converge un
            volumen transaccional recurrente con reglas de verificación susceptibles de formalización lógica
            (Syed et al., 2020). En el caso analizado, el problema central no radica en la falta de capacidad
            del personal contable, sino en la asignación de criterio profesional a tareas mecánicas de cotejo
            documental que pueden ser ejecutadas de manera determinística por un orquestador digital.
          </p>
          <p className="text-justify indent-8">
            La oportunidad de mejora se materializa al sustituir la digitación manual por un flujo híbrido
            orientado a eventos. Con base en los parámetros cuantitativos modelados en el estudio, la
            reducción del tiempo de procesamiento unitario desde{' '}
            <span className="tabular-nums">{roi.manualMinutesPerInvoice}</span> minutos hasta{' '}
            <span className="tabular-nums">{roi.automatedMinutesPerInvoice}</span> minutos por factura
            representa una disminución del{' '}
            <span className="tabular-nums font-semibold">{timeReductionPct.toFixed(1)}%</span> en el tiempo
            operativo de ciclo, liberando aproximadamente{' '}
            <span className="tabular-nums font-semibold">{hoursSavedMonth.toFixed(1)} horas</span> mensuales.
            Considerando el costo de hora analista de{' '}
            <span className="tabular-nums">${roi.analystHourlyCostCop.toLocaleString('es-CO')} COP</span> y la
            disminución de costos por retrabajo, el ahorro operativo anual proyectado asciende a{' '}
            <span className="tabular-nums font-semibold">
              ${Math.round(annualSavingsCop).toLocaleString('es-CO')} COP
            </span>
            .
          </p>
          <p className="text-justify indent-8">
            En cuanto al alcance del prototipo funcional, se delimitó un Producto Mínimo Viable (MVP) que
            abarca desde la recepción vía webhook de la factura hasta su causación en el libro auxiliar del
            ERP o su derivación hacia la cola de cuarentena. Quedan fuera del alcance automatizado las
            aprobaciones gerenciales de sobrecostos superiores al 5%, las cuales requieren explícitamente la
            intervención y firma de un responsable financiero humano.
          </p>
        </section>

        {/* SECCIÓN 4: MARCO TECNOLÓGICO */}
        <section className="apa-page-break space-y-4">
          <h3 className="text-lg font-bold text-slate-900">4. Marco Tecnológico</h3>
          <p className="text-justify indent-8">
            La selección tecnológica del proyecto responde a un enfoque arquitectónico por capas que evita
            depender de una única herramienta monolítica. Tal como advierten van der Aalst et al. (2018), el
            uso indiscriminado de robots de interfaz gráfica (RPA tradicional) sobre sistemas que ya disponen
            de interfaces de programación (API) genera soluciones frágiles ante cambios visuales mínimos. En
            consecuencia, se adopta una arquitectura API-first complementada selectivamente por RPA e
            inteligencia artificial aplicada.
          </p>

          <div className="apa-avoid-break my-6">
            <p className="text-xs font-bold text-slate-900">Tabla 1</p>
            <p className="text-xs italic text-slate-700 mb-2">
              Comparativa y justificación de la arquitectura tecnológica seleccionada
            </p>
            <table className="w-full text-left border-y border-slate-900 text-xs">
              <thead>
                <tr className="border-b border-slate-400 font-semibold">
                  <th className="py-2 pr-3">Capa</th>
                  <th className="py-2 pr-3">Tecnología</th>
                  <th className="py-2 pr-3">Rol operativo</th>
                  <th className="py-2">Sustento técnico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {TECHNOLOGY_COMPARISON.map((item) => (
                  <tr key={item.dimension} className="align-top">
                    <td className="py-2 pr-3 font-medium">{item.dimension}</td>
                    <td className="py-2 pr-3 font-mono text-[11px]">{item.technology}</td>
                    <td className="py-2 pr-3">{item.role}</td>
                    <td className="py-2">{item.justification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-justify indent-8">
            En primer lugar, Node-RED actúa como plataforma Low-Code de orquestación central basada en
            programación orientada a flujos (Flow-Based Programming), gracias a su modelo de ejecución dirigido
            por eventos, sus nodos nativos HTTP In/Request, bifurcaciones Switch, manejo explícito de errores
            mediante nodos Catch y licencia abierta Apache 2.0 (OpenJS Foundation, 2025). En segundo lugar, el
            componente de inteligencia artificial se circunscribe al reconocimiento óptico de caracteres (OCR)
            y a la clasificación semántica de conceptos de gasto para sugerir cuentas contables (Davenport &amp;
            Ronanki, 2018), manteniendo reglas determinísticas para toda validación matemática y tributaria.
          </p>
        </section>

        {/* SECCIÓN 5: DISEÑO DEL PROTOTIPO */}
        <section className="apa-page-break space-y-4">
          <h3 className="text-lg font-bold text-slate-900">5. Diseño del Prototipo</h3>

          <h4 className="text-base font-bold text-slate-900">5.1 Diagrama de flujo del proceso (BPMN 2.0)</h4>
          <p className="text-justify indent-8">
            La Figura 1 ilustra la modelación formal del proceso automatizado bajo la especificación BPMN 2.0,
            organizada en cuatro carriles funcionales (swimlanes): Proveedor, Orquestador Node-RED, Servicio de
            IA y API Fiscal, y ERP y Tesorería. Se incorpora un evento intermedio de borde para capturar errores
            de disponibilidad o rechazo tributario sin interrumpir el procesamiento de facturas posteriores.
          </p>

          <figure className="apa-avoid-break my-5 border border-slate-300 p-3">
            <figcaption className="text-xs mb-2">
              <span className="font-bold block">Figura 1</span>
              <span className="italic text-slate-700">
                Diagrama de proceso BPMN 2.0 con carriles funcionales y manejo de excepciones
              </span>
            </figcaption>
            <BpmnDiagramSvg svgRef={bpmnSvgRef} />
            <p className="text-[11px] text-slate-600 mt-2">
              Nota. Elaboración propia a partir del análisis de flujo TO-BE del proyecto.
            </p>
          </figure>

          <h4 className="text-base font-bold text-slate-900 pt-2">
            5.2 Descripción técnica del funcionamiento por nodos
          </h4>
          <p className="text-justify indent-8">
            El prototipo implementado en arquitectura Node-RED y respaldado por servicios REST reales en
            Node.js/Express se estructura en siete nodos interconectados (Tabla 2). Cada etapa aplica controles
            de validación de esquema, políticas de reintento exponencial frente a indisponibilidad transitoria
            (código HTTP 503) e idempotencia mediante verificación previa de duplicidad en el libro mayor del
            ERP (código HTTP 409).
          </p>

          <div className="apa-avoid-break my-4">
            <p className="text-xs font-bold text-slate-900">Tabla 2</p>
            <p className="text-xs italic text-slate-700 mb-2">
              Especificación técnica de los nodos implementados en el prototipo Node-RED
            </p>
            <table className="w-full text-left border-y border-slate-900 text-xs">
              <thead>
                <tr className="border-b border-slate-400 font-semibold">
                  <th className="py-2 pr-3">Nodo</th>
                  <th className="py-2 pr-3">Tipo técnico Node-RED</th>
                  <th className="py-2 pr-3">Manejo de errores</th>
                  <th className="py-2">Función dentro del flujo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {WORKFLOW_NODES.map((node) => (
                  <tr key={node.id} className="align-top">
                    <td className="py-2 pr-3 font-medium">{node.title}</td>
                    <td className="py-2 pr-3 font-mono text-[10px]">{node.n8nNodeType}</td>
                    <td className="py-2 pr-3">{node.retryPolicy}</td>
                    <td className="py-2">{node.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECCIÓN 6: EVIDENCIAS TÉCNICAS */}
        <section className="apa-page-break space-y-4">
          <h3 className="text-lg font-bold text-slate-900">6. Evidencias Técnicas y Registro de Pruebas</h3>
          <p className="text-justify indent-8">
            Para verificar la validez funcional y la resiliencia del prototipo, se ejecutaron pruebas
            controladas contra los endpoints REST del entorno de simulación empresarial. De conformidad con los
            requisitos de verificación de software, la Tabla 3 documenta los resultados obtenidos tanto en un
            escenario nominal exitoso como en un escenario de error controlado con activación de la ruta
            alterna de cuarentena financiera.
          </p>

          <div className="apa-avoid-break my-5">
            <p className="text-xs font-bold text-slate-900">Tabla 3</p>
            <p className="text-xs italic text-slate-700 mb-2">
              Registro de ejecuciones de prueba del prototipo funcional (escenarios exitoso y error controlado)
            </p>
            <table className="w-full text-left border-y border-slate-900 text-xs">
              <thead>
                <tr className="border-b border-slate-400 font-semibold">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Escenario evaluado</th>
                  <th className="py-2 pr-3">Factura</th>
                  <th className="py-2 pr-3 text-right">Monto (COP)</th>
                  <th className="py-2 pr-3 text-right">Latencia</th>
                  <th className="py-2">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.slice(0, 5).map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="py-2 pr-3 font-mono">{log.id}</td>
                    <td className="py-2 pr-3">{log.scenarioLabel}</td>
                    <td className="py-2 pr-3 font-mono">{log.invoiceNumber}</td>
                    <td className="py-2 pr-3 font-mono text-right tabular-nums">
                      ${log.amount.toLocaleString('es-CO')}
                    </td>
                    <td className="py-2 pr-3 font-mono text-right tabular-nums">
                      {log.totalDurationMs} ms
                    </td>
                    <td className="py-2 font-medium">{log.finalOutcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {successLog && (
            <div className="apa-avoid-break space-y-2 border border-slate-300 p-4 text-xs">
              <p className="font-bold text-slate-900">
                Evidencia A · Traza de ejecución exitosa ({successLog.id} — {successLog.invoiceNumber})
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-700">
                {successLog.steps.map((s, i) => (
                  <li key={`${successLog.id}-${i}`}>
                    <span className="font-semibold">{s.nodeName}</span> ({s.durationMs} ms
                    {s.httpStatus ? `, HTTP ${s.httpStatus}` : ''}): {s.summary}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {errorLog && (
            <div className="apa-avoid-break space-y-2 border border-slate-300 p-4 text-xs">
              <p className="font-bold text-slate-900">
                Evidencia B · Traza de error controlado ({errorLog.id} — {errorLog.invoiceNumber})
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-700">
                {errorLog.steps.map((s, i) => (
                  <li key={`${errorLog.id}-${i}`}>
                    <span className="font-semibold">{s.nodeName}</span> ({s.durationMs} ms
                    {s.httpStatus ? `, HTTP ${s.httpStatus}` : ''}): {s.summary}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {screenshots.nodeRedDataUrl && (
            <figure className="apa-avoid-break my-5 border border-slate-300 p-3">
              <figcaption className="text-xs mb-2">
                <span className="font-bold block">Figura 2</span>
                <span className="italic text-slate-700">
                  Captura de ejecución real del flujo orquestado en Node-RED
                </span>
              </figcaption>
              <img
                src={screenshots.nodeRedDataUrl}
                alt="Captura de flujo en Node-RED"
                className="w-full max-h-[420px] object-contain mx-auto border border-slate-200"
              />
              <p className="text-[11px] text-slate-600 mt-2">
                Nota. Captura de pantalla tomada del entorno operativo Node-RED durante las pruebas funcionales.
              </p>
            </figure>
          )}

          {screenshots.gmailDataUrl && (
            <figure className="apa-avoid-break my-5 border border-slate-300 p-3">
              <figcaption className="text-xs mb-2">
                <span className="font-bold block">
                  {screenshots.nodeRedDataUrl ? 'Figura 3' : 'Figura 2'}
                </span>
                <span className="italic text-slate-700">
                  Evidencia de notificación automatizada entregada mediante Gmail API
                </span>
              </figcaption>
              <img
                src={screenshots.gmailDataUrl}
                alt="Captura de notificación en Gmail"
                className="w-full max-h-[420px] object-contain mx-auto border border-slate-200"
              />
              <p className="text-[11px] text-slate-600 mt-2">
                Nota. Correo electrónico real generado por el flujo al finalizar la validación contable.
              </p>
            </figure>
          )}
        </section>

        {/* SECCIÓN 7: EVALUACIÓN CRÍTICA */}
        <section className="apa-page-break space-y-4">
          <h3 className="text-lg font-bold text-slate-900">7. Evaluación Crítica</h3>

          <h4 className="text-base font-bold text-slate-900">
            7.1 Beneficios esperados y desafíos técnicos u organizacionales
          </h4>
          <p className="text-justify indent-8">
            La automatización del ciclo de cuentas por pagar aporta beneficios directos en eficiencia
            operativa, trazabilidad de auditoría y reducción de errores humanos. La ejecución estandarizada
            garantiza que cada factura causada cuente con respaldo tributario verificado y cálculo exacto de
            retenciones, reduciendo el tiempo de procesamiento en un{' '}
            <span className="tabular-nums">{timeReductionPct.toFixed(1)}%</span>. No obstante, emergen
            desafíos relevantes: en el plano técnico, la heterogeneidad de formatos PDF enviados por pequeños
            proveedores y los cambios eventuales en los esquemas de APIs tributarias exigen monitoreo continuo;
            en el plano organizacional, la resistencia al cambio de los equipos contables puede obstaculizar la
            adopción si la solución se percibe como un mecanismo de vigilancia o desplazamiento laboral.
          </p>

          <h4 className="text-base font-bold text-slate-900 pt-2">
            7.2 Matriz de riesgos potenciales y estrategias de mitigación
          </h4>
          <p className="text-justify indent-8">
            Siguiendo los principios de gestión de seguridad de la información establecidos en la norma
            ISO/IEC 27001:2022 (International Organization for Standardization, 2022), se identificaron cuatro
            vectores de riesgo críticos con sus respectivas salvaguardas arquitectónicas (Tabla 4).
          </p>

          <div className="apa-avoid-break my-4">
            <p className="text-xs font-bold text-slate-900">Tabla 4</p>
            <p className="text-xs italic text-slate-700 mb-2">
              Evaluación de riesgos técnicos y estrategias de mitigación
            </p>
            <table className="w-full text-left border-y border-slate-900 text-xs">
              <thead>
                <tr className="border-b border-slate-400 font-semibold">
                  <th className="py-2 pr-3">Categoría</th>
                  <th className="py-2 pr-3">Riesgo identificado</th>
                  <th className="py-2 pr-3">Nivel</th>
                  <th className="py-2">Estrategia de mitigación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {RISK_MATRIX.map((r) => (
                  <tr key={r.category} className="align-top">
                    <td className="py-2 pr-3 font-medium">{r.category}</td>
                    <td className="py-2 pr-3">{r.risk}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {r.impact} ({r.likelihood})
                    </td>
                    <td className="py-2">{r.mitigation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="text-base font-bold text-slate-900 pt-2">
            7.3 Consideraciones éticas y responsabilidad profesional
          </h4>
          <p className="text-justify indent-8">
            El despliegue de sistemas automatizados asistidos por inteligencia artificial conlleva
            responsabilidades éticas ineludibles para el ingeniero de software (IEEE Global Initiative on
            Ethics of Autonomous and Intelligent Systems, 2019). En primer lugar, respecto al impacto laboral,
            la automatización debe orientarse a la liberación cognitiva (reconversión de auxiliares hacia
            análisis financiero, gestión de relaciones con proveedores y control presupuestal) y no a la
            supresión acrítica de puestos de trabajo sin planes de transición y capacitación.
          </p>
          <p className="text-justify indent-8">
            En segundo lugar, la arquitectura adopta el principio de transparencia y supervisión humana
            (Human-in-the-Loop): ningún modelo probabilístico está autorizado para aprobar pagos de forma
            autónoma fuera de las reglas determinísticas de la orden de compra. Toda decisión automatizada
            queda registrada en bitácoras auditables con marca temporal, carga útil y justificación técnica,
            asegurando la rendición de cuentas (accountability) y la protección de datos empresariales y
            personales contenidos en los documentos fiscales.
          </p>
        </section>

        {/* SECCIÓN 8: CONCLUSIONES Y RECOMENDACIONES */}
        <section className="apa-page-break space-y-4">
          <h3 className="text-lg font-bold text-slate-900">8. Conclusiones y Recomendaciones</h3>
          <p className="text-justify indent-8">
            El desarrollo del prototipo demuestra que la combinación de orquestación Low-Code mediante
            Node-RED, servicios REST desacoplados y extracción asistida por IA constituye una estrategia sólida
            para automatizar procesos administrativos de alto volumen como cuentas por pagar. Las pruebas ejecutadas
            validan tanto la eficiencia del camino nominal como la capacidad de la arquitectura para contener
            errores transitorios (HTTP 503 mediante reintentos exponenciales) y discrepancias de negocio (HTTP
            422 mediante aislamiento en cuarentena), evitando causaciones indebidas o duplicadas (HTTP 409).
          </p>
          <p className="text-justify indent-8">
            Desde el punto de vista organizacional y ético, se concluye que el éxito sostenible de una
            iniciativa de transformación digital depende de mantener al ser humano como autoridad final sobre
            las excepciones críticas y de acompañar la implementación técnica con programas de recapacitación
            del talento contable. Como recomendaciones para una fase de producción se sugiere: (a) implementar
            firmas HMAC en el webhook de recepción; (b) configurar tableros de observabilidad sobre tasas de
            confianza del OCR para detectar deriva documental; y (c) realizar auditorías trimestrales sobre las
            bitácoras de ejecución para garantizar cumplimiento continuo bajo estándares ISO/IEC 27001.
          </p>
        </section>

        {/* SECCIÓN 9: REFERENCIAS APA 7.ª ED. */}
        <section className="apa-page-break space-y-4">
          <h3 className="text-lg font-bold text-slate-900 text-center pb-2">Referencias</h3>
          <div className="space-y-4 text-sm">
            {APA_REFERENCES.map((ref) => (
              <p key={ref.citation} className="pl-8 -indent-8 leading-relaxed text-left">
                {ref.citation}
              </p>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
};
