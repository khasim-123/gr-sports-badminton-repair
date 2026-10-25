import React from 'react';
import { User } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { cx } from './ui';

/** Initials for the signed-in person ("Vikram Malhotra" -> "VM"). */
const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

/**
 * Account button for the public headers (homepage, T-shirt store, courts): a person icon when
 * signed out (opens the login), the person's initials when signed in (opens their account).
 */
export const AccountButton: React.FC<{ label: string; onClick: () => void; className?: string }> = ({ label, onClick, className }) => {
  const { isLoggedIn, userName } = useApp();
  const initials = isLoggedIn && userName ? initialsOf(userName) : '';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
        initials ? 'border-ink bg-ink text-white hover:bg-ink-hover' : 'border-line bg-white text-ink hover:border-ink/40',
        className,
      )}
    >
      {initials ? (
        <span className="text-[14px] font-semibold tracking-wide">{initials}</span>
      ) : (
        <User className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
};
