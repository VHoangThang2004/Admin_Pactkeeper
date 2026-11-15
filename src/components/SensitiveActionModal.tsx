import React, { useState } from 'react';
import { AlertTriangle, FileText, ShieldAlert, X } from 'lucide-react';
import type { AuditLogSeverity } from '../types';

interface SensitiveActionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  severity: Extract<AuditLogSeverity, 'HIGH' | 'CRITICAL'>;
  actionLabel: string;
  targetSummary?: string;
  requireKeyword?: string;
  minReasonLength?: number;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (rationale: string) => void | Promise<void>;
}

/**
 * Confirmation and mandatory rationale dialog for sensitive High Counsel actions.
 */
export const SensitiveActionModal: React.FC<SensitiveActionModalProps> = ({
  isOpen,
  title,
  description,
  severity,
  actionLabel,
  targetSummary,
  requireKeyword,
  minReasonLength = 5,
  loading = false,
  error = null,
  onCancel,
  onConfirm,
}) => {
  const [rationale, setRationale] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isCritical = severity === 'CRITICAL';

  const handleClose = () => {
    setRationale('');
    setKeywordInput('');
    setValidationError(null);
    onCancel();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedReason = rationale.trim();
    if (trimmedReason.length < minReasonLength) {
      setValidationError(
        `Please enter an audit rationale of at least ${minReasonLength} characters.`
      );
      return;
    }
    if (requireKeyword && keywordInput.trim().toUpperCase() !== requireKeyword.toUpperCase()) {
      setValidationError(`Type "${requireKeyword}" to confirm this critical operation.`);
      return;
    }

    setValidationError(null);
    await onConfirm(trimmedReason);
    setRationale('');
    setKeywordInput('');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className={`hy-glass w-full max-w-md rounded-2xl border p-6 space-y-4 shadow-2xl relative ${
          isCritical ? 'border-rose-500/45' : 'border-amber-400/40'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                isCritical
                  ? 'bg-rose-500/15 border-rose-500/35 text-rose-400'
                  : 'bg-amber-500/15 border-amber-400/35 text-amber-300'
              }`}
            >
              {isCritical ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <span
                className={`inline-block text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                  isCritical
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-400/30'
                }`}
              >
                {severity} SENSITIVE ACTION
              </span>
              <h3 className="text-base font-bold font-cinzel text-slate-100 mt-1">{title}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-white/10"
            aria-label="Close confirmation dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">{description}</p>

        {targetSummary && (
          <div className="rounded-xl bg-slate-950/70 border border-white/10 px-3.5 py-2.5 text-xs">
            <span className="text-slate-400">Target: </span>
            <span className="font-mono font-semibold text-amber-200">{targetSummary}</span>
          </div>
        )}

        {(validationError || error) && (
          <div className="rounded-xl bg-rose-950/60 border border-rose-500/40 px-3.5 py-2.5 text-xs text-rose-200">
            {validationError || error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Audit Rationale <span className="text-rose-400">*</span>
              </span>
            </label>
            <textarea
              rows={3}
              value={rationale}
              onChange={(e) => {
                setRationale(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="Explain why this sensitive action is being executed (recorded to Security Audit Log)..."
              className="w-full bg-[#090d1a] border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none resize-none"
            />
          </div>

          {requireKeyword && (
            <div>
              <label className="font-semibold text-slate-200 block mb-1.5">
                Type <code className="text-rose-300 font-mono">{requireKeyword}</code> to authorize
              </label>
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => {
                  setKeywordInput(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder={requireKeyword}
                className="w-full bg-[#090d1a] border border-rose-500/35 focus:border-rose-400 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 outline-none"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="hy-btn-glass px-3.5 py-2 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded-xl text-xs font-bold shadow transition-all disabled:opacity-50 ${
                isCritical
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'hy-btn-gold text-slate-950'
              }`}
            >
              {loading ? 'Executing...' : actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
