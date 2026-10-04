import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'white' | 'dark' | 'glass';
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
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none';

  let variantClasses = '';
  switch (variant) {
    case 'primary':
      variantClasses =
        'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md focus:ring-blue-500';
      break;
    case 'secondary':
      variantClasses =
        'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md focus:ring-emerald-500';
      break;
    case 'outline':
      variantClasses =
        'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs focus:ring-slate-400';
      break;
    case 'ghost':
      variantClasses =
        'bg-transparent hover:bg-slate-100 text-slate-700 focus:ring-slate-300';
      break;
    case 'danger':
      variantClasses =
        'bg-rose-600 hover:bg-rose-700 text-white shadow-sm focus:ring-rose-500';
      break;
    case 'success':
      variantClasses =
        'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm focus:ring-emerald-500';
      break;
    case 'white':
      variantClasses =
        'bg-white hover:bg-slate-100 text-slate-900 shadow-xl hover:shadow-2xl focus:ring-slate-200 border border-transparent font-bold';
      break;
    case 'dark':
      variantClasses =
        'bg-slate-850 hover:bg-slate-800 text-white border border-slate-700 shadow-sm focus:ring-slate-500';
      break;
    case 'glass':
      variantClasses =
        'bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-sm backdrop-blur-xs';
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
    variantClasses = variantClasses.replace(/\btext-(?:white|slate-700|slate-900)\b/g, '');
  }
  if (hasCustomBgColor) {
    variantClasses = variantClasses
      .replace(/\bbg-(?:blue|emerald|rose|white|slate|transparent)[-\w]*/g, '')
      .replace(/\bhover:bg-(?:blue|emerald|rose|slate)[-\w]*/g, '');
  }

  let sizeClasses = '';
  switch (size) {
    case 'sm':
      sizeClasses = 'text-xs px-3 py-1.5 gap-1.5';
      break;
    case 'md':
      sizeClasses = 'text-sm px-4 py-2.5 gap-2';
      break;
    case 'lg':
      sizeClasses = 'text-base px-6 py-3.5 gap-2.5 font-semibold';
      break;
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};
