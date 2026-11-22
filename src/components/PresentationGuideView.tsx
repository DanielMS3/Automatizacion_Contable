import React, { useState } from 'react';
import { CheckSquare, Clock, ExternalLink, Video } from 'lucide-react';
import { PRESENTATION_SLIDES } from '../data/projectContent';
import { StudentMetadata } from '../types/automation';

interface PresentationGuideViewProps {
  metadata: StudentMetadata;
  onUpdateMetadata: (next: StudentMetadata) => void;
}

export const PresentationGuideView: React.FC<PresentationGuideViewProps> = ({
  metadata,
  onUpdateMetadata,
}) => {
  const [activeSlide, setActiveSlide] = useState<number>(1);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    slides: true,
    duration: false,
    demo: true,
    youtube: false,
    linkInPdf: true,
  });

  const currentSlide =
    PRESENTATION_SLIDES.find((s) => s.number === activeSlide) ?? PRESENTATION_SLIDES[0];

  const toggleItem = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Producto 2 · Presentación Oral Individual (YouTube en modo oculto / restringido)
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">
              Guion de Diapositivas y Planificación de Sustentación (10–15 min)
            </h1>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-mono text-slate-600 tabular-nums shrink-0">
            <Clock className="w-4 h-4 text-blue-700" />
            <span>Duración planificada: 12 min 45 s · 10 diapositivas</span>
          </div>
        </div>

        {/* Slide navigator + active slide preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-1.5">
            {PRESENTATION_SLIDES.map((slide) => (
              <button
                key={slide.number}
                type="button"
                onClick={() => setActiveSlide(slide.number)}
                className={`w-full text-left px-3.5 py-2.5 rounded-md border text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                  activeSlide === slide.number
                    ? 'border-blue-700 bg-blue-50/50 text-slate-900 font-semibold'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">
                  {String(slide.number).padStart(2, '0')}. {slide.title}
                </span>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                  {slide.duration}
                </span>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 space-y-5">
            {/* Slide Mock Frame */}
            <div className="border border-slate-200 rounded-lg bg-slate-900 text-white p-8 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Diapositiva {currentSlide.number} de {PRESENTATION_SLIDES.length}
                </span>
                <span className="font-mono tabular-nums">{currentSlide.duration}</span>
              </div>
              <h2 className="text-xl font-bold text-white leading-snug">{currentSlide.title}</h2>
              <p className="text-sm text-slate-300 leading-relaxed">{currentSlide.keyMessage}</p>
              <div className="pt-4 border-t border-slate-800 text-xs text-slate-400">
                <span className="font-medium text-slate-200">Recurso visual sugerido: </span>
                {currentSlide.visualElement}
              </div>
            </div>

            {/* Speaker Notes */}
            <div className="border border-slate-200 rounded-lg p-5 space-y-3 bg-white">
              <h3 className="text-sm font-semibold text-slate-900">
                Puntos clave de exposición oral (Diapositiva {currentSlide.number})
              </h3>
              <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside leading-relaxed">
                {currentSlide.talkingPoints.map((pt, idx) => (
                  <li key={idx}>{pt}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Video Link & Final Submission Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-blue-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Registro del Enlace de Video (YouTube)
            </h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Una vez grabada la sustentación (10 a 15 minutos) y cargada en YouTube en modo de
            visualización restringida/no listado, pegue aquí el enlace definitivo para que quede
            incorporado automáticamente en la portada del informe PDF.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={metadata.youtubeUrl}
              onChange={(e) => onUpdateMetadata({ ...metadata, youtubeUrl: e.target.value })}
              placeholder="https://youtu.be/..."
              className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <a
              href={metadata.youtubeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Verificar enlace</span>
            </a>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-emerald-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Lista de Verificación de Entrega
            </h2>
          </div>
          <div className="space-y-2.5 text-xs text-slate-700">
            {[
              { key: 'slides', label: 'Diapositivas listas (PowerPoint / PDF)' },
              { key: 'demo', label: 'Demostración de flujo exitoso y error controlado' },
              { key: 'duration', label: 'Video grabado entre 10 y 15 minutos' },
              { key: 'youtube', label: 'Subido a YouTube con permisos de visualización correctos' },
              { key: 'linkInPdf', label: 'Enlace del video incluido en la portada del informe PDF' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(checklist[item.key])}
                  onChange={() => toggleItem(item.key)}
                  className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
