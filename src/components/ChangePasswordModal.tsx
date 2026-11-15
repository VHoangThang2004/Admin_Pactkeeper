import React, { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldAlert, X } from 'lucide-react';
import { changeOwnPassword } from '../services/adminSecurityService';

interface ChangePasswordModalProps {
  isOpen: boolean;
  username: string;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  username,
  onClose,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasMinLen = newPassword.length >= 8;
  const hasMixedCase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const matchesConfirm = newPassword.length > 0 && newPassword === confirmPassword;
  const differsFromCurrent =
    newPassword.length > 0 && currentPassword.length > 0 && newPassword !== currentPassword;

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccessMsg(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setError('Current passcode is required.');
      return;
    }
    if (!hasMinLen || !hasMixedCase || !hasDigit) {
      setError(
        'New passcode must be at least 8 characters and include uppercase, lowercase, and numeric digits.'
      );
      return;
    }
    if (!differsFromCurrent) {
      setError('New passcode must be different from your current passcode.');
      return;
    }
    if (!matchesConfirm) {
      setError('Confirmation passcode does not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await changeOwnPassword({ currentPassword, newPassword });
      setSuccessMsg(res.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update passcode.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="hy-glass w-full max-w-md rounded-2xl border border-amber-400/35 p-6 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-amber-300">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold font-cinzel text-slate-100">
                ROTATE COUNSEL PASSCODE
              </h3>
              <p className="text-[11px] text-slate-400">
                Account: <span className="font-mono text-amber-300">{username}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-white/10"
            aria-label="Close change password dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 px-3.5 py-2.5 text-xs text-rose-200 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-3.5 py-2.5 text-xs text-emerald-200 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Current Passcode
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current passcode"
              className="w-full bg-[#090d1a] border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              New Passcode
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 chars, mixed case + digit"
              className="w-full bg-[#090d1a] border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Confirm New Passcode
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new passcode"
              className="w-full bg-[#090d1a] border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-amber-300"
          >
            {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showPasswords ? 'Hide passcodes' : 'Show passcodes'}</span>
          </button>

          {/* Live strength checklist */}
          <div className="rounded-xl bg-slate-950/70 border border-white/10 p-3 space-y-1 text-[11px]">
            <div className={hasMinLen ? 'text-emerald-300' : 'text-slate-500'}>
              • Minimum 8 characters
            </div>
            <div className={hasMixedCase ? 'text-emerald-300' : 'text-slate-500'}>
              • Contains uppercase and lowercase letters
            </div>
            <div className={hasDigit ? 'text-emerald-300' : 'text-slate-500'}>
              • Contains at least one number
            </div>
            <div className={matchesConfirm ? 'text-emerald-300' : 'text-slate-500'}>
              • Matches confirmation field
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={handleClose}
              className="hy-btn-glass px-3.5 py-2 rounded-xl text-xs font-semibold"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="hy-btn-gold px-4 py-2 rounded-xl text-xs font-bold text-slate-950 disabled:opacity-50"
            >
              {submitting ? 'Updating...' : 'Update Passcode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
