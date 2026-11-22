import React from 'react';

interface BpmnDiagramSvgProps {
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export const BpmnDiagramSvg: React.FC<BpmnDiagramSvgProps> = ({ svgRef }) => {
  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1120 560"
      className="w-full h-auto bg-white"
      role="img"
      aria-label="Diagrama de proceso BPMN 2.0 para automatización de cuentas por pagar"
    >
      <defs>
        <marker
          id="bpmn-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#334155" />
        </marker>
        <marker
          id="bpmn-arrow-error"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#B91C1C" />
        </marker>
        <marker
          id="bpmn-msg-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#1D4ED8" />
        </marker>
      </defs>

      {/* Outer Pool */}
      <rect x="10" y="10" width="1100" height="540" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
      <rect x="10" y="10" width="38" height="540" fill="#F1F5F9" stroke="#0F172A" strokeWidth="1.5" />
      <text
        x="29"
        y="280"
        textAnchor="middle"
        transform="rotate(-90 29 280)"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontSize="12"
        fontWeight="700"
        fill="#0F172A"
      >
        PROCESO AUTOMATIZADO DE CUENTAS POR PAGAR (TO-BE)
      </text>

      {/* Lane 1: Proveedor */}
      <rect x="48" y="10" width="1062" height="105" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
      <rect x="48" y="10" width="32" height="105" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
      <text
        x="64"
        y="62"
        textAnchor="middle"
        transform="rotate(-90 64 62)"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontSize="11"
        fontWeight="600"
        fill="#475569"
      >
        Proveedor
      </text>

      {/* Lane 2: Orquestador Node-RED */}
      <rect x="48" y="115" width="1062" height="175" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
      <rect x="48" y="115" width="32" height="175" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
      <text
        x="64"
        y="202"
        textAnchor="middle"
        transform="rotate(-90 64 202)"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontSize="11"
        fontWeight="600"
        fill="#1D4ED8"
      >
        Orquestador Node-RED
      </text>

      {/* Lane 3: IA & API Tributaria */}
      <rect x="48" y="290" width="1062" height="125" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
      <rect x="48" y="290" width="32" height="125" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
      <text
        x="64"
        y="352"
        textAnchor="middle"
        transform="rotate(-90 64 352)"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontSize="11"
        fontWeight="600"
        fill="#475569"
      >
        IA y API Fiscal
      </text>

      {/* Lane 4: ERP & Analista Financiero */}
      <rect x="48" y="415" width="1062" height="135" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
      <rect x="48" y="415" width="32" height="135" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
      <text
        x="64"
        y="482"
        textAnchor="middle"
        transform="rotate(-90 64 482)"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontSize="11"
        fontWeight="600"
        fill="#475569"
      >
        ERP y Tesorería
      </text>

      {/* LANE 1 ELEMENTS */}
      <circle cx="130" cy="62" r="16" fill="#FFFFFF" stroke="#15803D" strokeWidth="2" />
      <text x="130" y="95" textAnchor="middle" fontSize="10" fill="#334155" fontFamily="Public Sans, sans-serif">
        Inicio envío
      </text>
      <rect x="190" y="36" width="150" height="52" rx="6" fill="#F8FAFC" stroke="#334155" strokeWidth="1.5" />
      <text x="265" y="59" textAnchor="middle" fontSize="11" fontWeight="600" fill="#0F172A" fontFamily="Public Sans, sans-serif">
        Emitir Factura XML/PDF
      </text>
      <text x="265" y="75" textAnchor="middle" fontSize="10" fill="#64748B" fontFamily="Public Sans, sans-serif">
        + Referencia de OC
      </text>
      <line x1="146" y1="62" x2="188" y2="62" stroke="#334155" strokeWidth="1.5" markerEnd="url(#bpmn-arrow)" />

      {/* Message Flow Proveedor -> Node-RED HTTP In */}
      <line
        x1="265"
        y1="88"
        x2="265"
        y2="178"
        stroke="#1D4ED8"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        markerEnd="url(#bpmn-msg-arrow)"
      />
      <text x="275" y="138" fontSize="10" fill="#1D4ED8" fontFamily="Public Sans, sans-serif">
        POST /http-in
      </text>

      {/* LANE 2 ELEMENTS (Orquestador Node-RED) */}
      {/* Intermediate Message Catch Event */}
      <circle cx="265" cy="198" r="17" fill="#EFF6FF" stroke="#1D4ED8" strokeWidth="2" />
      <circle cx="265" cy="198" r="13" fill="none" stroke="#1D4ED8" strokeWidth="1" />
      <text x="265" y="232" textAnchor="middle" fontSize="10" fontWeight="600" fill="#0F172A" fontFamily="Public Sans, sans-serif">
        Nodo HTTP In
      </text>

      {/* Task: Invocar OCR / IA */}
      <rect x="340" y="170" width="145" height="56" rx="6" fill="#EFF6FF" stroke="#1D4ED8" strokeWidth="1.5" />
      <text x="412" y="194" textAnchor="middle" fontSize="11" fontWeight="600" fill="#0F172A" fontFamily="Public Sans, sans-serif">
        Normalizar Payload
      </text>
      <text x="412" y="210" textAnchor="middle" fontSize="10" fill="#475569" fontFamily="Public Sans, sans-serif">
        Solicitar OCR &amp; IA
      </text>
      <line x1="282" y1="198" x2="338" y2="198" stroke="#334155" strokeWidth="1.5" markerEnd="url(#bpmn-arrow)" />

      {/* LANE 3: OCR & API Fiscal */}
      <rect x="340" y="322" width="145" height="56" rx="6" fill="#F8FAFC" stroke="#334155" strokeWidth="1.5" />
      <text x="412" y="346" textAnchor="middle" fontSize="11" fontWeight="600" fill="#0F172A" fontFamily="Public Sans, sans-serif">
        Extracción OCR &amp; IA
      </text>
      <text x="412" y="362" textAnchor="middle" fontSize="10" fill="#475569" fontFamily="Public Sans, sans-serif">
        NIT, CUFE, Cuenta GL
      </text>
      <line x1="412" y1="226" x2="412" y2="320" stroke="#334155" strokeWidth="1.5" markerEnd="url(#bpmn-arrow)" />

      {/* Task: Validar API Tributaria (with Retry Boundary Event) */}
      <rect x="530" y="322" width="165" height="56" rx="6" fill="#F8FAFC" stroke="#334155" strokeWidth="1.5" />
      <text x="612" y="346" textAnchor="middle" fontSize="11" fontWeight="600" fill="#0F172A" fontFamily="Public Sans, sans-serif">
        Validación Fiscal &amp; OC
      </text>
      <text x="612" y="362" textAnchor="middle" fontSize="10" fill="#475569" fontFamily="Public Sans, sans-serif">
        Tolerancia &lt;= 5% · 3x Retry
      </text>
      <line x1="485" y1="350" x2="528" y2="350" stroke="#334155" strokeWidth="1.5" markerEnd="url(#bpmn-arrow)" />

      {/* Boundary Error / Retry Event on Tax API */}
      <circle cx="672" cy="378" r="12" fill="#FEF2F2" stroke="#B91C1C" strokeWidth="1.5" />
      <circle cx="672" cy="378" r="9" fill="none" stroke="#B91C1C" strokeWidth="1" />
      <text x="672" y="382" textAnchor="middle" fontSize="9" fontWeight="700" fill="#B91C1C">
        !
      </text>
      <text x="618" y="401" fontSize="9" fill="#B91C1C" fontFamily="Public Sans, sans-serif">
        Error 503/422
      </text>

      {/* Arrow back up to XOR Gateway in Lane 2 */}
      <polyline
        points="612,322 612,240 612,226"
        fill="none"
        stroke="#334155"
        strokeWidth="1.5"
        markerEnd="url(#bpmn-arrow)"
      />

      {/* XOR Gateway in Lane 2 */}
      <polygon
        points="612,164 644,196 612,228 580,196"
        fill="#FFFBEB"
        stroke="#B45309"
        strokeWidth="1.5"
      />
      <text x="612" y="201" textAnchor="middle" fontSize="14" fontWeight="700" fill="#B45309">
        X
      </text>
      <text x="612" y="154" textAnchor="middle" fontSize="10" fontWeight="600" fill="#0F172A" fontFamily="Public Sans, sans-serif">
        ¿Válida y sin exceso?
      </text>

      {/* Happy Path -> Lane 2 Causar ERP -> Lane 4 */}
      <rect x="735" y="170" width="155" height="56" rx="6" fill="#ECFDF5" stroke="#15803D" strokeWidth="1.5" />
      <text x="812" y="194" textAnchor="middle" fontSize="11" fontWeight="600" fill="#0F172A" fontFamily="Public Sans, sans-serif">
        Enviar Asiento al ERP
      </text>
      <text x="812" y="210" textAnchor="middle" fontSize="10" fill="#475569" fontFamily="Public Sans, sans-serif">
        Control idempotencia 409
      </text>
      <line x1="644" y1="196" x2="733" y2="196" stroke="#334155" strokeWidth="1.5" markerEnd="url(#bpmn-arrow)" />
      <text x="688" y="188" textAnchor="middle" fontSize="10" fontWeight="600" fill="#15803D" fontFamily="Public Sans, sans-serif">
        Sí (200)
      </text>

      {/* LANE 4: ERP Causation & Notification */}
      <rect x="735" y="452" width="155" height="56" rx="6" fill="#F8FAFC" stroke="#334155" strokeWidth="1.5" />
      <text x="812" y="476" textAnchor="middle" fontSize="11" fontWeight="600" fill="#0F172A" fontFamily="Public Sans, sans-serif">
        Causar Obligación ERP
      </text>
      <text x="812" y="492" textAnchor="middle" fontSize="10" fill="#475569" fontFamily="Public Sans, sans-serif">
        Retención y neto a pagar
      </text>
      <line x1="812" y1="226" x2="812" y2="450" stroke="#334155" strokeWidth="1.5" markerEnd="url(#bpmn-arrow)" />

      <rect x="935" y="452" width="115" height="56" rx="6" fill="#F8FAFC" stroke="#334155" strokeWidth="1.5" />
      <text x="992" y="476" textAnchor="middle" fontSize="11" fontWeight="600" fill="#0F172A" fontFamily="Public Sans, sans-serif">
        Notificar Pago
      </text>
      <text x="992" y="492" textAnchor="middle" fontSize="10" fill="#475569" fontFamily="Public Sans, sans-serif">
        Tesorería
      </text>
      <line x1="890" y1="480" x2="933" y2="480" stroke="#334155" strokeWidth="1.5" markerEnd="url(#bpmn-arrow)" />

      {/* End Event Happy */}
      <circle cx="1078" cy="480" r="14" fill="#ECFDF5" stroke="#15803D" strokeWidth="3" />
      <line x1="1050" y1="480" x2="1062" y2="480" stroke="#334155" strokeWidth="1.5" markerEnd="url(#bpmn-arrow)" />
      <text x="1078" y="512" textAnchor="middle" fontSize="10" fontWeight="600" fill="#15803D" fontFamily="Public Sans, sans-serif">
        Fin OK
      </text>

      {/* Error Path from Gateway / Boundary -> Quarantine */}
      <polyline
        points="672,390 672,480 530,480"
        fill="none"
        stroke="#B91C1C"
        strokeWidth="1.5"
        markerEnd="url(#bpmn-arrow-error)"
      />
      <rect x="340" y="452" width="188" height="56" rx="6" fill="#FEF2F2" stroke="#B91C1C" strokeWidth="1.5" />
      <text x="434" y="476" textAnchor="middle" fontSize="11" fontWeight="600" fill="#991B1B" fontFamily="Public Sans, sans-serif">
        Cuarentena y Alerta Analista
      </text>
      <text x="434" y="492" textAnchor="middle" fontSize="10" fill="#7F1D1D" fontFamily="Public Sans, sans-serif">
        Revisión humana (HITL)
      </text>
      <circle cx="265" cy="480" r="14" fill="#FEF2F2" stroke="#B91C1C" strokeWidth="3" />
      <line x1="340" y1="480" x2="281" y2="480" stroke="#B91C1C" strokeWidth="1.5" markerEnd="url(#bpmn-arrow-error)" />
      <text x="265" y="512" textAnchor="middle" fontSize="10" fontWeight="600" fill="#B91C1C" fontFamily="Public Sans, sans-serif">
        Fin Excepción
      </text>
    </svg>
  );
};
