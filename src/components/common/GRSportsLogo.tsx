import React from 'react';

interface GRSportsLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  theme?: 'light' | 'dark';
}

export const GRSportsLogo: React.FC<GRSportsLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  theme = 'light'
}) => {
  // Dimensions based on size prop
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base sm:text-lg',
    lg: 'text-xl sm:text-2xl',
    xl: 'text-2xl sm:text-3xl'
  };

  const subTextSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-xs',
    xl: 'text-sm'
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Dynamic GR Sports Emblem */}
      <div
        className={`${iconSizes[size]} relative rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-emerald-500 p-[1.5px] shadow-md shadow-blue-600/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200`}
      >
        <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center overflow-hidden relative">
          {/* Subtle sport speed lines in background */}
          <svg
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full p-1"
          >
            {/* Speed Arc */}
            <path
              d="M6 32C12 28 26 24 34 10"
              stroke="url(#grGradientAccent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="2 3"
              opacity="0.6"
            />
            {/* Stylized Shuttlecock / Wings */}
            <path
              d="M20 7L24 16L20 18L16 16L20 7Z"
              fill="url(#grGradient)"
            />
            <path
              d="M16 16L12 11L18 17"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M24 16L28 11L22 17"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Cork / Head */}
            <circle
              cx="20"
              cy="21.5"
              r="2.5"
              fill="#10b981"
            />

            {/* Bold GR Letters Monogram at Base */}
            <text
              x="20"
              y="34"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="9"
              fontWeight="900"
              fontFamily="system-ui, -apple-system, sans-serif"
              letterSpacing="0.5"
            >
              GR
            </text>

            <defs>
              <linearGradient id="grGradient" x1="16" y1="7" x2="24" y2="21" gradientUnits="userSpaceOnUse">
                <stop stopColor="#60a5fa" />
                <stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="grGradientAccent" x1="6" y1="32" x2="34" y2="10" gradientUnits="userSpaceOnUse">
                <stop stopColor="#10b981" />
                <stop offset="1" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Brand Name Typography */}
      {showText && (
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black tracking-tight font-sans ${textSizes[size]} ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}
            >
              GR <span className="text-blue-600">SPORTS</span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full border border-emerald-300/60">
              PRO
            </span>
          </div>
          <p
            className={`${subTextSizes[size]} font-semibold tracking-wide hidden sm:block ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Badminton Stringing &amp; Repair Hub
          </p>
        </div>
      )}
    </div>
  );
};
