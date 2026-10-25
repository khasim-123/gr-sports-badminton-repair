import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { SignInPanel, signInHeading } from './SignInPanel';

/**
 * Sign-in dialog (opened from the top bar, the footer's staff/admin links and the booking flow).
 * Customers: mobile + SMS code. Staff and admins: mobile + password.
 * Rendered into <body> so a blurred/sticky header can't clip it; above toasts (errors are shown inline).
 */
export const AuthModal: React.FC = () => {
  const { authModalOpen, setAuthModalOpen, authModalRole, setAuthModalRole } = useApp();
  if (!authModalOpen) return null;
  return <AuthDialog role={authModalRole} onRoleChange={setAuthModalRole} onClose={() => setAuthModalOpen(false)} />;
};

const AuthDialog: React.FC<{
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  onClose: () => void;
}> = ({ role, onRoleChange, onClose }) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<{ stage: 'MOBILE' | 'OTP' | 'PROFILE'; mobile: string | null }>({ stage: 'MOBILE', mobile: null });
  const heading = signInHeading(role, stage.stage, stage.mobile);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    const root = document.documentElement;
    const prevOverflowY = root.style.overflowY;
    root.style.overflowY = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      root.style.overflowY = prevOverflowY;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center sm:p-4 bg-ink/60 animate-in fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col animate-in zoom-in-95 max-h-[calc(100dvh-0.75rem)] sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 shrink-0">
          <div className="min-w-0 pt-1">
            <h2 id={titleId} className="font-display tracking-[0.01em] text-2xl sm:text-[28px] leading-tight font-semibold text-slate-900">
              {heading.title}
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">{heading.text}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 -mr-2 shrink-0 flex items-center justify-center rounded-xl text-slate-500 hover:text-ink hover:bg-paper transition-colors duration-150"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <SignInPanel
            role={role}
            tabs={role === 'CUSTOMER' ? 'none' : 'staff'}
            onRoleChange={onRoleChange}
            onStageChange={(s, mobile) => setStage({ stage: s, mobile })}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AuthModal;
