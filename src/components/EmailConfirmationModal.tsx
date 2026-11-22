import React, { useEffect, useState } from 'react';
import { Mail, X } from 'lucide-react';

export interface PendingEmailDraft {
  executionId?: string;
  to: string;
  subject: string;
  body: string;
}

interface EmailConfirmationModalProps {
  draft: PendingEmailDraft | null;
  sending: boolean;
  errorMessage: string;
  onCancel: () => void;
  onConfirm: (finalDraft: PendingEmailDraft) => Promise<void>;
}

export const EmailConfirmationModal: React.FC<EmailConfirmationModalProps> = ({
  draft,
  sending,
  errorMessage,
  onCancel,
  onConfirm,
}) => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (draft) {
      setTo(draft.to);
      setSubject(draft.subject);
      setBody(draft.body);
    }
  }, [draft]);

  if (!draft) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gmail-confirm-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-xl w-full p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <Mail className="w-5 h-5 text-blue-700 shrink-0" />
            <div>
              <h2 id="gmail-confirm-title" className="text-base font-semibold text-slate-900">
                Confirmar envío de notificación por Gmail
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Se enviará un correo real desde tu cuenta de Google autorizada.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            className="p-1.5 text-slate-400 hover:text-slate-900 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <label className="block">
            <span className="font-medium text-slate-700">Destinatario</span>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>

          <label className="block">
            <span className="font-medium text-slate-700">Asunto</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>

          <label className="block">
            <span className="font-medium text-slate-700">Contenido del mensaje</span>
            <textarea
              rows={7}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
        </div>

        {errorMessage && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
            {errorMessage}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={sending || !to.trim() || !subject.trim()}
            onClick={() =>
              onConfirm({
                executionId: draft.executionId,
                to: to.trim(),
                subject: subject.trim(),
                body,
              })
            }
            className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
          >
            {sending ? 'Enviando correo…' : 'Confirmar y enviar correo'}
          </button>
        </div>
      </div>
    </div>
  );
};
