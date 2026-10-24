import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, KeyRound, X } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Staff / admin: change your own password (POST /api/auth/change-password). */
export const ChangePasswordModal: React.FC<Props> = ({ open, onClose }) => {
  const { addToast } = useApp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
    setShow(false);
    setTimeout(() => firstInput.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setError('The new password must be at least 8 characters.');
    if (next !== confirm) return setError("The new passwords don't match.");
    if (next === current) return setError('Choose a password different from your current one.');
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/auth/change-password', { currentPassword: current, newPassword: next });
      addToast('success', 'Password changed', 'Use your new password the next time you sign in.');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not change the password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputType = show ? 'text' : 'password';
  const inputCls =
    'mt-1 w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

  // Rendered into <body>: the top bar uses backdrop-blur, which would otherwise trap this
  // fixed overlay inside the bar and cut the dialog off.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-4 bg-slate-900/60 overflow-y-auto"
      onClick={() => !saving && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm my-auto bg-white rounded-3xl shadow-2xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 id="change-password-title" className="flex items-center gap-2 text-base font-black text-slate-900">
            <KeyRound className="w-5 h-5 text-blue-600" /> Change password
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="block text-xs font-bold text-slate-700">
          Current password
          <input
            ref={firstInput}
            type={inputType}
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          New password <span className="font-medium text-slate-400">(at least 8 characters)</span>
          <input
            type={inputType}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          Confirm new password
          <input
            type={inputType}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputCls}
          />
        </label>
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="flex items-center gap-1.5 min-h-[36px] text-xs font-bold text-slate-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {show ? 'Hide passwords' : 'Show passwords'}
        </button>

        {error && (
          <p role="alert" className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 min-h-[44px] rounded-xl border border-slate-300 text-sm font-bold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 min-h-[44px] rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
};
