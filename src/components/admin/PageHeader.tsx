import React from 'react';

/**
 * One page header for every admin page: title (Barlow Condensed, sentence case), one line of context
 * and the page's actions on the right (wrapping under the title on narrow screens).
 */
export const PageHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small line above the title, e.g. today's date on the dashboard. */
  eyebrow?: React.ReactNode;
}> = ({ title, subtitle, actions, eyebrow }) => (
  <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-x-6 gap-y-3">
    <div className="min-w-0">
      {eyebrow && <p className="text-[13px] font-semibold text-slate-500 mb-0.5">{eyebrow}</p>}
      <h2 className="font-display tracking-[0.01em] text-[28px] sm:text-[34px] leading-[1.1] font-bold text-ink break-words">
        {title}
      </h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1 max-w-3xl">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">{actions}</div>}
  </header>
);
