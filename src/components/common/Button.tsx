import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** `accent` = the yellow call to action — use it for at most one button per screen. */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'white' | 'dark' | 'glass' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  let baseClasses =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none';

  let variantClasses = '';
  switch (variant) {
    case 'primary':
      variantClasses =
        'bg-ink hover:bg-ink-hover text-white focus-visible:ring-ink';
      break;
    case 'secondary':
      variantClasses =
        'border border-line bg-white hover:bg-paper text-ink focus-visible:ring-ink';
      break;
    case 'accent':
      variantClasses =
        'bg-accent hover:bg-accent-hover text-ink focus-visible:ring-ink';
      break;
    case 'outline':
      variantClasses =
        'border border-line bg-white hover:bg-paper hover:border-slate-300 text-slate-800 focus-visible:ring-ink';
      break;
    case 'ghost':
      variantClasses =
        'bg-transparent hover:bg-paper-deep/70 text-slate-700 focus-visible:ring-ink';
      break;
    case 'danger':
      variantClasses =
        'bg-rose-600 hover:bg-rose-700 text-white focus-visible:ring-rose-500';
      break;
    case 'success':
      variantClasses =
        'bg-emerald-600 hover:bg-emerald-700 text-white focus-visible:ring-emerald-500';
      break;
    case 'white':
      variantClasses =
        'bg-white hover:bg-slate-100 text-slate-900 focus-visible:ring-white border border-transparent font-bold';
      break;
    case 'dark':
      variantClasses =
        'bg-ink hover:bg-ink-hover text-white border border-slate-700 focus-visible:ring-ink';
      break;
    case 'glass':
      variantClasses =
        'bg-white/10 hover:bg-white/20 text-white border border-white/20 focus-visible:ring-white';
      break;
  }

  // Prevent Tailwind cascade clashes when caller specifies custom text or background colors
  const hasCustomTextColor =
    /\btext-(?!white\b)[a-z]+-\d+/.test(className) ||
    /\btext-slate-900\b/.test(className) ||
    /\btext-black\b/.test(className);
  const hasCustomBgColor =
    /\bbg-[a-z]+-\d+/.test(className) ||
    /\bbg-white\b/.test(className) ||
    /\bbg-black\b/.test(className);

  if (hasCustomTextColor) {
    variantClasses = variantClasses.replace(/\btext-(?:white|ink|slate-700|slate-800|slate-900)(?![-\w/])/g, '');
  }
  if (hasCustomBgColor) {
    variantClasses = variantClasses
      .replace(/\bbg-(?:blue|emerald|rose|white|slate|transparent)[-\w]*/g, '')
      .replace(/\bhover:bg-(?:blue|emerald|rose|slate)[-\w]*/g, '');
  }

  let sizeClasses = '';
  switch (size) {
    case 'sm':
      sizeClasses = 'text-[13px] px-3 py-1.5 min-h-[36px] gap-1.5';
      break;
    case 'md':
      sizeClasses = 'text-sm px-4 py-2.5 min-h-[40px] gap-2';
      break;
    case 'lg':
      sizeClasses = 'text-base px-6 py-3 min-h-[48px] gap-2.5 font-semibold';
      break;
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        leftIcon && <span className="shrink-0" aria-hidden="true">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && <span className="shrink-0" aria-hidden="true">{rightIcon}</span>}
    </button>
  );
};
