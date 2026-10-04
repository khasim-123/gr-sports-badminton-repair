import React from 'react';

export const CardSkeleton: React.FC = () => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs animate-pulse space-y-4">
    <div className="flex items-center justify-between">
      <div className="h-4 bg-slate-200 rounded w-1/3" />
      <div className="h-6 bg-slate-200 rounded-full w-20" />
    </div>
    <div className="space-y-2">
      <div className="h-3 bg-slate-100 rounded w-3/4" />
      <div className="h-3 bg-slate-100 rounded w-1/2" />
    </div>
    <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
      <div className="h-4 bg-slate-200 rounded w-1/4" />
      <div className="h-8 bg-slate-200 rounded-xl w-24" />
    </div>
  </div>
);

export const TableSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden animate-pulse">
    <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between">
      <div className="h-5 bg-slate-200 rounded w-36" />
      <div className="h-5 bg-slate-200 rounded w-24" />
    </div>
    <div className="divide-y divide-slate-100">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-4 flex items-center justify-between gap-4">
          <div className="h-4 bg-slate-200 rounded w-24" />
          <div className="h-4 bg-slate-100 rounded w-32 hidden sm:block" />
          <div className="h-4 bg-slate-100 rounded w-20" />
          <div className="h-6 bg-slate-200 rounded-full w-24" />
          <div className="h-8 bg-slate-200 rounded-xl w-16" />
        </div>
      ))}
    </div>
  </div>
);
