import React from 'react';
import { useShopSettings } from '../../../hooks/useShopSettings';

/** Shared look for the public homepage: buttons, section headings, form fields, small icons. */

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue';

export const btn = {
  base: `inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl text-[15px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${focusRing}`,
  /** Main action on light backgrounds. */
  primary: 'bg-sportsBlue text-white hover:bg-[#003b63]',
  /** Main action on photos / dark backgrounds. */
  accent: 'bg-accent text-ink hover:bg-accent-hover',
  /** Secondary action on light backgrounds. */
  secondary: 'bg-white text-ink border border-line hover:border-ink/40',
  /** Secondary action on photos / dark backgrounds. */
  onDark: 'text-white border border-white/45 hover:bg-white/10 hover:border-white/70',
  /** Text-like button. */
  link: `inline-flex items-center gap-1.5 min-h-[44px] text-[15px] font-semibold text-sportsBlue underline decoration-sportsBlue/30 underline-offset-4 hover:decoration-sportsBlue ${focusRing} rounded`,
};

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export const container = 'mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8';

interface SectionHeaderProps {
  id?: string;
  eyebrow?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'light' | 'dark';
  className?: string;
}

/** Eyebrow + h2 + intro, with an optional action on the right (wide screens). */
export const SectionHeader: React.FC<SectionHeaderProps> = ({ id, eyebrow, title, intro, action, tone = 'light', className }) => (
  <div className={cx('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
    <div className="max-w-2xl">
      {eyebrow && (
        <p className={cx('text-[13px] font-semibold tracking-wide', tone === 'dark' ? 'text-accent' : 'text-[#9A6B00]')}>{eyebrow}</p>
      )}
      <h2
        id={id}
        data-section-heading
        className={cx(
          eyebrow && 'mt-1',
          'font-display font-semibold text-[34px] sm:text-[42px] leading-[1.02] tracking-[-0.005em] text-balance outline-none',
          tone === 'dark' ? 'text-white' : 'text-ink',
        )}
      >
        {title}
      </h2>
      {intro && (
        <p className={cx('mt-3 text-[16px] leading-relaxed text-pretty', tone === 'dark' ? 'text-white/75' : 'text-ink-soft')}>{intro}</p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

export const fieldLabel = 'block text-[14px] font-medium text-ink mb-1.5';
export const fieldHint = 'mt-1.5 text-[13px] text-ink-muted';
export const fieldControl = `block w-full min-h-[46px] rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink placeholder:text-ink-muted/70 transition-colors hover:border-ink/30 focus:border-sportsBlue focus:outline-none focus:ring-2 focus:ring-sportsBlue/15 disabled:bg-paper disabled:text-ink-muted aria-[invalid=true]:border-flameRed`;

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...rest }) => (
  <div className="relative">
    <select {...rest} className={cx(fieldControl, 'appearance-none pr-10', className)}>
      {children}
    </select>
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

/** WhatsApp glyph (lucide has no brand icons). */
export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z" />
  </svg>
);

/** Five stars, filled to the rounded rating. Decorative: pass the text label separately. */
export const Stars: React.FC<{ rating: number; className?: string }> = ({ rating, className = 'h-4 w-4' }) => {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={cx(className, i < full ? 'text-[#E3A008]' : 'text-line')} fill="currentColor">
          <path d="M10 1.8l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.42l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.8z" />
        </svg>
      ))}
    </span>
  );
};

/** Small shop wordmark (name + tagline from the shop settings) used in the header and footer. */
export const Wordmark: React.FC<{ tone?: 'light' | 'dark'; subline?: boolean; sublineText?: string }> = ({
  tone = 'light',
  subline = true,
  sublineText,
}) => {
  const shop = useShopSettings();
  return (
  <span className="inline-flex items-center gap-2.5">
    <span
      className={cx(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
        tone === 'dark' ? 'bg-white/10 ring-1 ring-white/15' : 'bg-ink',
      )}
      aria-hidden="true"
    >
      {/* Shuttlecock mark */}
      <svg viewBox="0 0 32 32" className="h-7 w-7">
        <path d="M8.5 5.5h15l-4.2 13.2h-6.6Z" fill="none" stroke="#FCD116" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M13.5 5.5l1.2 13.2M18.5 5.5l-1.2 13.2M10.6 12h10.8" stroke="#FCD116" strokeWidth="1.2" opacity=".8" />
        <path d="M12.4 19.2h7.2a3.6 3.6 0 0 1-7.2 0Z" fill="#fff" />
      </svg>
    </span>
    <span className="leading-none">
      <span className={cx('block font-display font-bold text-[25px] tracking-[0.01em]', tone === 'dark' ? 'text-white' : 'text-ink')}>
        {shop.name}
      </span>
      {subline && (sublineText || shop.tagline) && (
        <span className={cx('mt-1 block text-[12px] font-medium', tone === 'dark' ? 'text-white/60' : 'text-ink-muted')}>
          {sublineText || shop.tagline}
        </span>
      )}
    </span>
  </span>
  );
};
