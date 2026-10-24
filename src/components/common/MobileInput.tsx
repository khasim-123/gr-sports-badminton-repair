import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { sanitizeMobileInput } from '../../utils/phone';

type Theme = 'light' | 'dark';

interface MobileInputProps {
  /** The 10 local digits (no +91). */
  value: string;
  onChange: (digits: string) => void;
  theme?: Theme;
  id?: string;
  name?: string;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Tailwind focus-ring colour class for the wrapper, e.g. "focus-within:ring-emerald-500". */
  ringClass?: string;
  placeholder?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/** Indian mobile number field: fixed "+91" prefix, numeric keypad, digits only (max 10). */
export const MobileInput: React.FC<MobileInputProps> = ({
  value,
  onChange,
  theme = 'light',
  id,
  name = 'mobile',
  required,
  autoFocus,
  disabled,
  ringClass = 'focus-within:ring-blue-500',
  placeholder = '98765 43210',
  ...aria
}) => {
  const dark = theme === 'dark';
  return (
    <div
      className={`flex items-stretch w-full rounded-xl border overflow-hidden focus-within:ring-2 ${ringClass} transition-all ${
        dark ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-300'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <span
        className={`flex items-center px-3 text-sm font-semibold select-none border-r ${
          dark ? 'text-slate-300 bg-slate-800/80 border-slate-700' : 'text-slate-600 bg-slate-50 border-slate-200'
        }`}
        aria-hidden="true"
      >
        +91
      </span>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        value={value}
        onChange={(e) => onChange(sanitizeMobileInput(e.target.value))}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label="Mobile number"
        aria-describedby={aria['aria-describedby']}
        aria-invalid={aria['aria-invalid']}
        className={`flex-1 min-w-0 px-3 py-2.5 text-sm font-semibold tracking-wide bg-transparent outline-none ${
          dark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
        }`}
      />
    </div>
  );
};

interface OtpCodeInputProps {
  value: string;
  onChange: (code: string) => void;
  theme?: Theme;
  id?: string;
  autoFocus?: boolean;
  ringClass?: string;
}

/** 6-digit SMS code field (lets phones offer the code from the SMS). */
export const OtpCodeInput: React.FC<OtpCodeInputProps> = ({
  value,
  onChange,
  theme = 'light',
  id,
  autoFocus,
  ringClass = 'focus:ring-blue-500',
}) => {
  const dark = theme === 'dark';
  return (
    <div className="relative">
      <KeyRound
        className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}
      />
      <input
        id={id}
        name="one-time-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="6-digit code"
        autoFocus={autoFocus}
        required
        aria-label="6-digit code from SMS"
        className={`w-full pl-10 pr-4 py-3 text-center tracking-[0.4em] text-lg font-mono font-bold rounded-xl border outline-none focus:ring-2 ${ringClass} ${
          dark
            ? 'bg-slate-900/80 border-slate-700 text-white placeholder-slate-500 placeholder:tracking-normal placeholder:text-sm'
            : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 placeholder:tracking-normal placeholder:text-sm'
        }`}
      />
    </div>
  );
};

/** Countdown (seconds) before a new SMS code may be requested. */
export const useResendCountdown = (seconds = 30): [number, () => void, () => void] => {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);
  const start = useCallback(() => setRemaining(seconds), [seconds]);
  const reset = useCallback(() => setRemaining(0), []);
  return [remaining, start, reset];
};
