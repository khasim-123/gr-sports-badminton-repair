import React from 'react';
import { Wordmark } from '../public/home/ui';

interface GRSportsLogoProps {
  className?: string;
  showText?: boolean;
  theme?: 'light' | 'dark';
}

/** GR Sports brand mark used in the app headers/footers — the same wordmark as the homepage.
 * The location line is shown from the `sm` breakpoint up, so phone headers keep room for their buttons. */
export const GRSportsLogo: React.FC<GRSportsLogoProps> = ({ className = '', showText = true, theme = 'light' }) => (
  <span className={className}>
    <span className="sm:hidden">
      <Wordmark tone={theme} subline={false} />
    </span>
    <span className="hidden sm:inline">
      <Wordmark tone={theme} subline={showText} />
    </span>
  </span>
);
