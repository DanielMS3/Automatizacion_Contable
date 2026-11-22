import React, { useRef } from 'react';
import { Download } from 'lucide-react';
import { BpmnDiagramSvg } from './BpmnDiagramSvg';
import { TECHNOLOGY_COMPARISON } from '../data/projectContent';

export const BpmnArchitectureView: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleDownloadSvg = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgRef.current);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Figura_1_Diagrama_BPMN_Cuentas_Por_Pagar.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* BPMN Diagram Panel */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Figura 1 · Modelo de Proceso Empresarial (Notación BPMN 2.0)
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">
              Diagrama de Carriles (Swimlanes) y Manejo de Excepciones
            </h1>
          </div>
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Descargar SVG</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-md bg-white p-2">
          <div className="min-w-[820px]">
            <BpmnDiagramSvg svgRef={svgRef} />
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Nota: El diagrama representa los cuatro actores lógicos del flujo (Proveedor, Orquestador Node-RED,
          Servicio IA/API Fiscal y ERP/Tesorería), incluyendo evento de borde para errores de validación
          (HTTP 422/503) y ruta de revisión humana (Human-in-the-Loop).
        </p>
      </div>

      {/* Technology Stack Justification Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Tabla 1 · Arquitectura Tecnológica Seleccionada
          </p>
          <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
            Integración de Low-Code (Node-RED), RPA e Inteligencia Artificial Aplicada
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50">
                <th className="py-3 px-4">Capa arquitectónica</th>
                <th className="py-3 px-4">Tecnología seleccionada</th>
                <th className="py-3 px-4">Función en el prototipo</th>
                <th className="py-3 px-4">Sustento de ingeniería</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {TECHNOLOGY_COMPARISON.map((row) => (
                <tr key={row.dimension} className="hover:bg-slate-50/70 align-top">
                  <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                    {row.dimension}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-blue-800">{row.technology}</td>
                  <td className="py-3.5 px-4 text-slate-700">{row.role}</td>
                  <td className="py-3.5 px-4 text-slate-600 leading-relaxed">{row.justification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
