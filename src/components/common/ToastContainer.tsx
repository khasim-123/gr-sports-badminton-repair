import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

/** True while any modal dialog is in the page (watched only while toasts are showing). */
const useDialogOpen = (watch: boolean) => {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!watch) return;
    const check = () => setOpen(!!document.querySelector('[aria-modal="true"]'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal'] });
    return () => observer.disconnect();
  }, [watch]);
  return watch && open;
};

/**
 * Toasts: bottom-right on larger screens. On phones they sit at the top — or at the bottom (above
 * the safe area) while a dialog is open, so they never cover the dialog's title. Announced to screen readers.
 */
export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();
  const dialogOpen = useDialogOpen(toasts.length > 0);

  return (
    <div
      className={`fixed inset-x-0 sm:inset-x-auto sm:top-auto sm:bottom-5 sm:right-5 z-[80] flex flex-col gap-2.5 max-w-sm w-full mx-auto sm:mx-0 pointer-events-none px-4 sm:px-0 ${
        dialogOpen ? 'bottom-[max(0.75rem,env(safe-area-inset-bottom))]' : 'top-3'
      }`}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        let icon = <Info className="w-5 h-5 text-ink-soft shrink-0" aria-hidden="true" />;
        let accent = 'border-l-ink';

        if (toast.type === 'success') {
          icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />;
          accent = 'border-l-emerald-500';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" aria-hidden="true" />;
          accent = 'border-l-amber-500';
        } else if (toast.type === 'error') {
          icon = <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" aria-hidden="true" />;
          accent = 'border-l-rose-500';
        }

        return (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 pl-3.5 pr-1.5 py-3 rounded-2xl border border-line border-l-4 bg-white shadow-lg animate-in fade-in slide-in-from-right-4 ${accent}`}
          >
            <span className="pt-0.5">{icon}</span>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-slate-900 leading-snug">{toast.title}</p>
              {toast.message && <p className="text-[13px] text-slate-600 mt-0.5 leading-relaxed">{toast.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-paper transition-colors duration-150"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
