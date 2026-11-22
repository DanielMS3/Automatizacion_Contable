import {
  InvoiceTestPayload,
  RoiParameters,
  StudentMetadata,
  WorkflowNodeDefinition,
} from '../types/automation';

export const DEFAULT_STUDENT_METADATA: StudentMetadata = {
  courseName: 'Seminario de Actualización en Ingeniería de Software',
  projectTitle:
    'Automatización Inteligente de Cuentas por Pagar y Validación Tributaria de Facturas Electrónicas mediante Orquestación Low-Code (Node-RED), RPA e IA Aplicada',
  studentName: 'Estudiante de Ingeniería de Software',
  institution: 'Facultad de Ingeniería y Ciencias Básicas',
  date: 'Noviembre de 2026',
  youtubeUrl: 'https://youtu.be/enlace-restringido-pendiente',
};

export const DEFAULT_ROI_PARAMETERS: RoiParameters = {
  monthlyInvoices: 450,
  manualMinutesPerInvoice: 18,
  automatedMinutesPerInvoice: 1.5,
  analystHourlyCostCop: 32000,
  manualErrorRatePercent: 7.4,
  errorReworkCostCop: 48000,
};

export const WORKFLOW_NODES: WorkflowNodeDefinition[] = [
  {
    id: 'trigger-webhook',
    title: 'Recepción Buzón / HTTP In',
    subtitle: 'node-red: http in',
    type: 'trigger',
    x: 40,
    y: 120,
    n8nNodeType: 'http in (POST /facturas-electronicas)',
    retryPolicy: 'N/A (Disparador)',
    endpoint: 'POST /api/webhook/invoices',
    description:
      'Nodo de entrada HTTP In en Node-RED que captura la llegada de facturas electrónicas (XML UBL 2.1, PDF o JSON) desde el buzón o portal de proveedores.',
  },
  {
    id: 'ocr-ai',
    title: 'Extracción OCR & Clasificación IA',
    subtitle: 'http request -> /api/ocr/extract',
    type: 'ai',
    x: 260,
    y: 120,
    n8nNodeType: 'http request + function',
    retryPolicy: 'Catch Node + Reintento: 2 veces · 800 ms',
    endpoint: 'POST /api/ocr/extract',
    description:
      'Normaliza campos fiscales (NIT, CUFE, subtotal, OC) mediante Gemini OCR y sugiere la cuenta contable PUC según el concepto facturado.',
  },
  {
    id: 'tax-api',
    title: 'Validación Tributaria & OC',
    subtitle: 'http request -> /api/tax-registry/validate',
    type: 'http',
    x: 480,
    y: 120,
    n8nNodeType: 'http request (retry loop)',
    retryPolicy: 'Delay + Loop: 3 intentos · Backoff exponencial',
    endpoint: 'POST /api/tax-registry/validate',
    description:
      'Consulta la API tributaria y el maestro de órdenes de compra (OC) para verificar vigencia fiscal, titularidad del NIT y tolerancia máxima del 5%.',
  },
  {
    id: 'decision-if',
    title: 'Regla de Decisión (Switch)',
    subtitle: 'msg.payload.ok == true ?',
    type: 'decision',
    x: 700,
    y: 120,
    n8nNodeType: 'switch (Evaluación condicional)',
    retryPolicy: 'Evaluación determinística',
    description:
      'Nodo Switch de Node-RED que bifurca el mensaje: puerto 1 hacia causación ERP cuando todas las reglas se cumplen; puerto 2 hacia cuarentena ante discrepancias.',
  },
  {
    id: 'erp-post',
    title: 'Causación Contable en ERP',
    subtitle: 'http request -> /api/erp/entries',
    type: 'erp',
    x: 930,
    y: 45,
    n8nNodeType: 'http request (POST ERP)',
    retryPolicy: 'Idempotencia por número de factura (HTTP 409)',
    endpoint: 'POST /api/erp/entries',
    description:
      'Registra el asiento contable en el libro mayor del ERP con cálculo automático de retención en la fuente, centro de costo y neto a pagar.',
  },
  {
    id: 'notify-success',
    title: 'Notificación a Tesorería',
    subtitle: 'http request -> /api/notifications/dispatch',
    type: 'erp',
    x: 1150,
    y: 45,
    n8nNodeType: 'http request + http response',
    retryPolicy: 'Catch Node garantizado',
    endpoint: 'POST /api/notifications/dispatch',
    description:
      'Envía confirmación estructurada al webhook de Tesorería con el identificador del asiento contable y responde HTTP 201 al emisor.',
  },
  {
    id: 'quarantine-alert',
    title: 'Catch & Cuarentena Controlada',
    subtitle: 'catch -> /api/quarantine',
    type: 'error',
    x: 930,
    y: 215,
    n8nNodeType: 'catch + http request (cuarentena)',
    retryPolicy: 'Ruta alterna garantizada (Fail-Safe)',
    endpoint: 'POST /api/quarantine',
    description:
      'Captura excepciones de red, errores HTTP 422/409 o baja confianza OCR mediante el nodo Catch de Node-RED, aislando la factura en la cola HITL sin detener el flujo.',
  },
];

export const TEST_PRESETS: InvoiceTestPayload[] = [
  {
    scenarioLabel: 'Escenario 1 (Exitoso): Factura conciliada con OC-2026-4490',
    invoiceNumber: 'FAC-2026-0895',
    vendorName: 'Soluciones Cloud Andina S.A.S.',
    vendorNit: '901245781-3',
    purchaseOrder: 'OC-2026-4490',
    amount: 4250000,
    simulateTransientError: false,
    corruptedPayload: false,
  },
  {
    scenarioLabel: 'Escenario 2 (Error Controlado): Sobrecosto +21% sobre OC',
    invoiceNumber: 'FAC-2026-0896',
    vendorName: 'Soluciones Cloud Andina S.A.S.',
    vendorNit: '901245781-3',
    purchaseOrder: 'OC-2026-4490',
    amount: 5150000,
    simulateTransientError: false,
    corruptedPayload: false,
  },
  {
    scenarioLabel: 'Escenario 3 (Reintento Exitoso): Falla API 503 recuperada',
    invoiceNumber: 'FAC-2026-0897',
    vendorName: 'Consultora Ciberseguridad Nexo Ltda.',
    vendorNit: '900881340-7',
    purchaseOrder: 'OC-2026-4502',
    amount: 6500000,
    simulateTransientError: true,
    corruptedPayload: false,
  },
  {
    scenarioLabel: 'Escenario 4 (Error Controlado): XML malformado en OCR',
    invoiceNumber: 'FAC-2026-0898',
    vendorName: 'Proveedor Externo Sin Validar',
    vendorNit: '901112233-9',
    purchaseOrder: 'OC-2026-4491',
    amount: 2800000,
    simulateTransientError: false,
    corruptedPayload: true,
  },
];

export const TECHNOLOGY_COMPARISON = [
  {
    dimension: 'Capa de Orquestación',
    technology: 'Node-RED (OpenJS Foundation · Flow-Based Low-Code)',
    role: 'Motor visual basado en flujos de eventos, nodos HTTP In/Request, bifurcaciones Switch, nodos Catch y funciones JavaScript.',
    justification:
      'Es 100 % gratuito bajo licencia Apache 2.0, sin límites de ejecuciones ni restricciones de licencia comercial; permite ejecución local o en contenedores con auditoría visual inmediata.',
  },
  {
    dimension: 'Automatización de Interfaz (RPA)',
    technology: 'Conectores RPA / Scripts Headless',
    role: 'Interacción con módulos legados sin API REST expuesta (descarga de anexos y carga en ERP antiguo).',
    justification:
      'Complementa la estrategia API-first evitando rupturas en procesos heredados mientras se completa la modernización del ERP corporativo.',
  },
  {
    dimension: 'Inteligencia Artificial Aplicada',
    technology: 'Extracción OCR Multimodal (Gemini) + Clasificación Semántica',
    role: 'Lectura de facturas en PDF, imagen o texto no estructurado y sugerencia de cuenta contable PUC.',
    justification:
      'Reduce el esfuerzo humano en facturas heterogéneas manteniendo supervisión humana (Human-in-the-Loop) cuando la confianza es inferior al umbral establecido.',
  },
];

export const RISK_MATRIX = [
  {
    category: 'Seguridad e Integridad de Datos',
    risk: 'Exposición de información tributaria sensible (NIT, montos, cuentas bancarias) o inyección de facturas apócrifas vía endpoint HTTP In.',
    likelihood: 'Media',
    impact: 'Alto',
    mitigation:
      'Autenticación Bearer/HMAC en nodos HTTP In, cifrado TLS 1.3 en tránsito, cifrado de credenciales en Node-RED (credentialSecret) y verificación estricta del CUFE.',
  },
  {
    category: 'Disponibilidad y Fallos en APIs Externas',
    risk: 'Caídas temporales de la API tributaria o bloqueos del ERP que provoquen pérdida de facturas o causación duplicada.',
    likelihood: 'Alta',
    impact: 'Medio',
    mitigation:
      'Nodos Catch + Delay con espera exponencial (3 intentos), control de idempotencia por número de factura (HTTP 409) y cola de cuarentena con alertas automáticas.',
  },
  {
    category: 'Dependencia Tecnológica (Vendor Lock-in)',
    risk: 'Atadura contractual o incrementos de tarifas por ejecución en plataformas SaaS propietarias de automatización.',
    likelihood: 'Baja',
    impact: 'Medio',
    mitigation:
      'Adopción de Node-RED (código abierto Apache 2.0) desplegado en infraestructura propia o Docker y lógica de negocio desacoplada en microservicios REST estándar.',
  },
  {
    category: 'Deriva o Alucinación en Clasificación IA',
    risk: 'Asignación incorrecta de cuentas contables o centros de costo por parte del modelo de clasificación automática.',
    likelihood: 'Media',
    impact: 'Medio',
    mitigation:
      'Umbral mínimo de confianza (>= 0.85) para aprobación automática, validación determinística contra la OC maestra y revisión humana obligatoria en excepciones.',
  },
];

export const APA_REFERENCES = [
  {
    citation:
      'Davenport, T. H., & Ronanki, R. (2018). Artificial intelligence for the real world. Harvard Business Review, 96(1), 108–116.',
  },
  {
    citation:
      'Hammer, M., & Champy, J. (1993). Reengineering the corporation: A manifesto for business revolution. HarperBusiness.',
  },
  {
    citation:
      'IEEE Global Initiative on Ethics of Autonomous and Intelligent Systems. (2019). Ethically aligned design: A vision for prioritizing human well-being with autonomous and intelligent systems (1.ª ed.). IEEE.',
  },
  {
    citation:
      'International Organization for Standardization. (2022). Information security, cybersecurity and privacy protection — Information security management systems — Requirements (Norma ISO/IEC 27001:2022). ISO.',
  },
  {
    citation:
      'OpenJS Foundation. (2025). Node-RED documentation: Creating flows, handling errors with Catch nodes, and HTTP endpoints. https://nodered.org/docs/',
  },
  {
    citation:
      'Syed, R., Suriadi, S., Adams, M., Bandara, W., Leemans, S. J. J., Ouyang, C., ter Hofstede, A. H. M., van de Weerd, I., Wynn, M. T., & Reijers, H. A. (2020). Robotic process automation: Contemporary themes and challenges. Computers in Industry, 115, Artículo 103162. https://doi.org/10.1016/j.compind.2019.103162',
  },
  {
    citation:
      'van der Aalst, W. M. P., Bichler, M., & Heinzl, A. (2018). Robotic process automation. Business & Information Systems Engineering, 60(4), 269–272. https://doi.org/10.1007/s12599-018-0542-4',
  },
  {
    citation:
      'vom Brocke, J., & Rosemann, M. (Eds.). (2015). Handbook on business process management 1: Introduction, methods, and information systems (2.ª ed.). Springer.',
  },
];

export interface SlideOutline {
  number: number;
  title: string;
  duration: string;
  keyMessage: string;
  visualElement: string;
  talkingPoints: string[];
}

export const PRESENTATION_SLIDES: SlideOutline[] = [
  {
    number: 1,
    title: 'Portada y Contexto del Proyecto',
    duration: '0:45 min',
    keyMessage: 'Presentación del reto empresarial: transformar cuentas por pagar manuales en un flujo auditable y resiliente.',
    visualElement: 'Título del proyecto, nombre del estudiante, curso Seminario de Actualización e índice visual.',
    talkingPoints: [
      'Saludo formal y presentación del rol asumido como ingeniero de software orientado a la transformación digital.',
      'Planteamiento de la tesis central: automatizar no es solo acelerar tareas, sino gobernar riesgos técnicos y éticos.',
    ],
  },
  {
    number: 2,
    title: 'Selección y Diagnóstico del Proceso (AS-IS)',
    duration: '1:30 min',
    keyMessage: 'El proceso de recepción, validación y causación de facturas consume 18 min/unidad con 7.4% de retrabajo.',
    visualElement: 'Mapa de entradas, actores, puntos de decisión y tabla de dolor operativo actual.',
    talkingPoints: [
      'Explicación de entradas (XML/PDF, OC), salidas (asiento en ERP, notificación) y actores involucrados.',
      'Evidencia del cuello de botella: digitación manual repetitiva, riesgo de doble causación y pérdida de descuentos por pronto pago.',
    ],
  },
  {
    number: 3,
    title: 'Justificación y Retorno de la Automatización',
    duration: '1:15 min',
    keyMessage: 'La automatización libera ~124 horas mensuales del equipo contable y reduce errores de digitación en más del 90%.',
    visualElement: 'Comparativa AS-IS vs. TO-BE con horas ahorradas y ahorro económico anual proyectado.',
    talkingPoints: [
      'Argumentación basada en criterios de idoneidad: alto volumen, reglas estables y datos estructurables.',
      'Alcance definido del MVP: conciliación automática con OC hasta umbral del 5% y escalamiento humano en excepciones.',
    ],
  },
  {
    number: 4,
    title: 'Marco Tecnológico: Node-RED, RPA e IA Aplicada',
    duration: '1:15 min',
    keyMessage: 'Arquitectura abierta: Node-RED (Apache 2.0) como orquestador de eventos, OCR/IA con Gemini y APIs REST.',
    visualElement: 'Diagrama de capas tecnológicas y matriz comparativa de selección.',
    talkingPoints: [
      'Sustento teórico según van der Aalst et al. (2018) y Syed et al. (2020) sobre estrategia API-first frente a RPA frágil.',
      'Justificación de Node-RED frente a opciones SaaS pagas: cero costo de licenciamiento, ejecución local/Docker y control total de datos fiscales.',
    ],
  },
  {
    number: 5,
    title: 'Diagrama de Proceso BPMN 2.0 (TO-BE)',
    duration: '1:15 min',
    keyMessage: 'Modelo formal con 4 carriles (Proveedor, Node-RED, API Tributaria/IA y ERP) y compuertas de excepción.',
    visualElement: 'Figura 1: Diagrama BPMN completo exportado desde la aplicación.',
    talkingPoints: [
      'Recorrido de los carriles y eventos de borde de error (Error Boundary Events).',
      'Explicación de la compuerta XOR para separar causación directa de la cola de cuarentena financiera.',
    ],
  },
  {
    number: 6,
    title: 'Demostración del Prototipo Funcional en Node-RED',
    duration: '2:15 min',
    keyMessage: 'Ejecución en vivo del flujo completo: HTTP In / Inject, OCR IA Gemini, validación API, Switch, causación ERP y notificación.',
    visualElement: 'Captura o demostración en pantalla del flujo Node-RED (flows.json importado) y la consola web.',
    talkingPoints: [
      'Mostrar la estructura modular de nodos (http in, http request, switch, catch) y la conexión directa con el backend REST.',
      'Ejecutar en vivo una factura real verificando extracción IA, código HTTP 201 en el ERP y cálculo automático de retención.',
    ],
  },
  {
    number: 7,
    title: 'Evidencias Técnicas: Manejo de Errores y Pruebas',
    duration: '1:45 min',
    keyMessage: 'Resiliencia comprobada ante fallos HTTP 503 (reintento) y discrepancias HTTP 422 (nodo Catch y cuarentena HITL).',
    visualElement: 'Tabla de registro de pruebas comparando Escenario Exitoso vs. Error Controlado.',
    talkingPoints: [
      'Demostrar el Escenario 2 (sobrecosto > 5%) y cómo la cola de Cuarentena HITL permite aprobación o rechazo humano.',
      'Explicar el control de idempotencia HTTP 409 para impedir el pago duplicado de una misma factura.',
    ],
  },
  {
    number: 8,
    title: 'Evaluación Crítica: Riesgos y Seguridad',
    duration: '1:15 min',
    keyMessage: 'Gestión proactiva de ciberseguridad (ISO/IEC 27001), calidad de datos y eliminación de vendor lock-in.',
    visualElement: 'Matriz de riesgos técnicos y organizacionales con sus controles de mitigación.',
    talkingPoints: [
      'Análisis de riesgos: suplantación en endpoints HTTP, caída de servicios tributarios y deriva en modelos OCR/IA.',
      'Controles aplicados: cifrado de credenciales en Node-RED, auditoría inmutable y principio de mínimo privilegio.',
    ],
  },
  {
    number: 9,
    title: 'Consideraciones Éticas y Responsabilidad Profesional',
    duration: '1:15 min',
    keyMessage: 'Diseño centrado en las personas (Human-in-the-Loop): reconversión del rol contable hacia análisis estratégico.',
    visualElement: 'Cuadro de principios éticos (IEEE Ethically Aligned Design): transparencia, supervisión y bienestar laboral.',
    talkingPoints: [
      'Impacto organizacional: evitar el reemplazo punitivo mediante planes de capacitación (reskilling) del personal.',
      'Responsabilidad del ingeniero de software: trazabilidad de decisiones automatizadas y no delegación ciega en la IA.',
    ],
  },
  {
    number: 10,
    title: 'Conclusiones, Lecciones Aprendidas y Cierre',
    duration: '0:45 min',
    keyMessage: 'La automatización madura equilibra eficiencia operativa, software abierto desacoplado y gobernanza ética.',
    visualElement: 'Síntesis de 3 lecciones clave, recomendaciones a futuro y referencias APA.',
    talkingPoints: [
      'Lección 1: El manejo de errores (nodos Catch y cuarentena) define la confiabilidad en producción.',
      'Lección 2: Combinar determinismo contable con IA probabilística exige umbrales claros y auditoría continua.',
    ],
  },
];

export function generateNodeRedFlowJson(baseUrl: string) {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const tabId = 'tab-custodios-ap';

  return [
    {
      id: tabId,
      type: 'tab',
      label: 'Cuentas por Pagar (Node-RED + IA)',
      disabled: false,
      info: 'Flujo real de automatización para Seminario de Actualización - Custodios de la Innovación',
    },
    {
      id: 'nr-inject-ok',
      type: 'inject',
      z: tabId,
      name: 'Prueba Exitosa (OC-2026-4490)',
      props: [{ p: 'payload' }],
      repeat: '',
      crontab: '',
      once: false,
      onceDelay: 0.1,
      topic: '',
      payload: JSON.stringify({
        invoiceNumber: 'FAC-NR-1001',
        vendorName: 'Soluciones Cloud Andina S.A.S.',
        vendorNit: '901245781-3',
        purchaseOrder: 'OC-2026-4490',
        amount: 4250000,
      }),
      payloadType: 'json',
      x: 170,
      y: 120,
      wires: [['nr-http-ocr']],
    },
    {
      id: 'nr-inject-err',
      type: 'inject',
      z: tabId,
      name: 'Prueba Error Controlado (+21% OC)',
      props: [{ p: 'payload' }],
      repeat: '',
      crontab: '',
      once: false,
      onceDelay: 0.1,
      topic: '',
      payload: JSON.stringify({
        invoiceNumber: 'FAC-NR-1002',
        vendorName: 'Soluciones Cloud Andina S.A.S.',
        vendorNit: '901245781-3',
        purchaseOrder: 'OC-2026-4490',
        amount: 5150000,
      }),
      payloadType: 'json',
      x: 170,
      y: 180,
      wires: [['nr-http-ocr']],
    },
    {
      id: 'nr-http-in',
      type: 'http in',
      z: tabId,
      name: 'Webhook Recepcion Facturas',
      url: '/facturas-electronicas',
      method: 'post',
      upload: false,
      swaggerDoc: '',
      x: 160,
      y: 260,
      wires: [['nr-http-ocr']],
    },
    {
      id: 'nr-http-ocr',
      type: 'http request',
      z: tabId,
      name: '1. OCR & Clasificacion IA',
      method: 'POST',
      ret: 'obj',
      paytoqs: 'ignore',
      url: `${cleanBase}/api/ocr/extract`,
      tls: '',
      persist: false,
      proxy: '',
      insecureHTTPParser: false,
      authType: '',
      senderr: false,
      headers: [{ keyType: 'other', keyValue: 'Content-Type', valueType: 'other', valueValue: 'application/json' }],
      x: 440,
      y: 180,
      wires: [['nr-http-tax']],
    },
    {
      id: 'nr-http-tax',
      type: 'http request',
      z: tabId,
      name: '2. Validacion Tributaria & OC',
      method: 'POST',
      ret: 'obj',
      paytoqs: 'ignore',
      url: `${cleanBase}/api/tax-registry/validate`,
      tls: '',
      persist: false,
      proxy: '',
      insecureHTTPParser: false,
      authType: '',
      senderr: false,
      headers: [{ keyType: 'other', keyValue: 'Content-Type', valueType: 'other', valueValue: 'application/json' }],
      x: 700,
      y: 180,
      wires: [['nr-switch-valid']],
    },
    {
      id: 'nr-switch-valid',
      type: 'switch',
      z: tabId,
      name: '3. Regla IF (Cumple?)',
      property: 'payload.ok',
      propertyType: 'msg',
      rules: [
        { t: 'true' },
        { t: 'else' },
      ],
      checkall: 'true',
      repair: false,
      outputs: 2,
      x: 940,
      y: 180,
      wires: [['nr-http-erp'], ['nr-http-quarantine']],
    },
    {
      id: 'nr-http-erp',
      type: 'http request',
      z: tabId,
      name: '4A. Causacion Contable ERP',
      method: 'POST',
      ret: 'obj',
      paytoqs: 'ignore',
      url: `${cleanBase}/api/erp/entries`,
      tls: '',
      persist: false,
      proxy: '',
      insecureHTTPParser: false,
      authType: '',
      senderr: false,
      headers: [{ keyType: 'other', keyValue: 'Content-Type', valueType: 'other', valueValue: 'application/json' }],
      x: 1190,
      y: 120,
      wires: [['nr-http-notify', 'nr-http-resp']],
    },
    {
      id: 'nr-http-notify',
      type: 'http request',
      z: tabId,
      name: '5. Notificacion Tesoreria',
      method: 'POST',
      ret: 'obj',
      paytoqs: 'ignore',
      url: `${cleanBase}/api/notifications/dispatch`,
      tls: '',
      persist: false,
      proxy: '',
      insecureHTTPParser: false,
      authType: '',
      senderr: false,
      headers: [{ keyType: 'other', keyValue: 'Content-Type', valueType: 'other', valueValue: 'application/json' }],
      x: 1450,
      y: 120,
      wires: [['nr-debug-ok']],
    },
    {
      id: 'nr-catch-all',
      type: 'catch',
      z: tabId,
      name: 'Catch Errores HTTP / Runtime',
      scope: null,
      uncaught: false,
      x: 940,
      y: 300,
      wires: [['nr-fn-error']],
    },
    {
      id: 'nr-fn-error',
      type: 'function',
      z: tabId,
      name: 'Preparar Alerta Cuarentena',
      func: 'msg.payload = {\n  invoiceNumber: (msg.payload && msg.payload.invoiceNumber) || "FAC-NR-ERR",\n  reasonCode: "NODERED_CATCH_ERROR",\n  reasonMessage: (msg.error && msg.error.message) || "Excepcion capturada en flujo Node-RED"\n};\nreturn msg;',
      outputs: 1,
      noerr: 0,
      x: 1190,
      y: 300,
      wires: [['nr-http-quarantine']],
    },
    {
      id: 'nr-http-quarantine',
      type: 'http request',
      z: tabId,
      name: '4B. Cuarentena HITL',
      method: 'POST',
      ret: 'obj',
      paytoqs: 'ignore',
      url: `${cleanBase}/api/quarantine`,
      tls: '',
      persist: false,
      proxy: '',
      insecureHTTPParser: false,
      authType: '',
      senderr: false,
      headers: [{ keyType: 'other', keyValue: 'Content-Type', valueType: 'other', valueValue: 'application/json' }],
      x: 1190,
      y: 220,
      wires: [['nr-debug-err', 'nr-http-resp']],
    },
    {
      id: 'nr-http-resp',
      type: 'http response',
      z: tabId,
      name: 'Respuesta HTTP',
      statusCode: '',
      headers: {},
      x: 1440,
      y: 220,
      wires: [],
    },
    {
      id: 'nr-debug-ok',
      type: 'debug',
      z: tabId,
      name: 'Log Exitoso',
      active: true,
      tosidebar: true,
      console: false,
      tostatus: false,
      complete: 'payload',
      targetType: 'msg',
      x: 1670,
      y: 120,
      wires: [],
    },
    {
      id: 'nr-debug-err',
      type: 'debug',
      z: tabId,
      name: 'Log Error Controlado',
      active: true,
      tosidebar: true,
      console: false,
      tostatus: false,
      complete: 'payload',
      targetType: 'msg',
      x: 1450,
      y: 300,
      wires: [],
    },
  ];
}
