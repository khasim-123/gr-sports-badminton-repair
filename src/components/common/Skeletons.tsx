import React from 'react';

/** Placeholder bar with a calm shimmer (flat with reduced motion — see index.css). */
const Bar: React.FC<{ className: string }> = ({ className }) => <div className={`skeleton-shimmer rounded ${className}`} />;

export const CardSkeleton: React.FC = () => (
  <div className="bg-white p-5 rounded-2xl border border-line space-y-4" aria-hidden="true">
    <div className="flex items-center justify-between">
      <Bar className="h-4 w-1/3" />
      <Bar className="h-6 rounded-full w-20" />
    </div>
    <div className="space-y-2">
      <Bar className="h-3 w-3/4" />
      <Bar className="h-3 w-1/2" />
    </div>
    <div className="pt-3 border-t border-line/70 flex justify-between items-center">
      <Bar className="h-4 w-1/4" />
      <Bar className="h-8 rounded-xl w-24" />
    </div>
  </div>
);

export const TableSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl border border-line overflow-hidden" aria-hidden="true">
    <div className="p-4 bg-paper border-b border-line flex justify-between">
      <Bar className="h-5 w-36" />
      <Bar className="h-5 w-24" />
    </div>
    <div className="divide-y divide-line/70">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-4 flex items-center justify-between gap-4">
          <Bar className="h-4 w-24" />
          <Bar className="h-4 w-32 hidden sm:block" />
          <Bar className="h-4 w-20" />
          <Bar className="h-6 rounded-full w-24" />
          <Bar className="h-8 rounded-xl w-16" />
        </div>
      ))}
    </div>
  </div>
);
