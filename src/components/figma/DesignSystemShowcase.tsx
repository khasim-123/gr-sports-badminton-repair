import React from 'react';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/Badge';
import { CardSkeleton, TableSkeleton } from '../common/Skeletons';
import { EmptyState } from '../common/EmptyStates';
import { useApp } from '../../context/AppContext';
import { RequestStatus } from '../../types';
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Truck,
  DollarSign,
  Clock,
  Sparkles,
} from 'lucide-react';

export const DesignSystemShowcase: React.FC = () => {
  const { addToast } = useApp();
  const allStatuses: RequestStatus[] = [
    'Submitted',
    'Accepted',
    'Employee Assigned',
    'Pickup Scheduled',
    'Bat Picked Up',
    'Inspection',
    'Repair Estimate',
    'Awaiting Customer Approval',
    'Repair Approved',
    'Getting in Progress',
    'Repair in Progress',
    'Getting Completed',
    'Repair Completed',
    'Out for Delivery',
    'Delivered',
    'Payment Pending',
    'Payment Collected',
    'Completed',
    'Repair Declined',
    'Cancelled',
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-12 pb-16">
      {/* Title */}
      <div className="border-b border-slate-200 pb-6">
        <span className="text-xs font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
          FIGMA FILE PAGES 02 &amp; 03
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2">
          Design System &amp; Component Library
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete atomic design system tailored for a premium sports-service SaaS application.
        </p>
      </div>

      {/* 1. COLOR SYSTEM (Figma Item 9) */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">1. Color System</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs">
          <div className="p-4 rounded-2xl bg-[#1e3a8a] text-white shadow-sm">
            <p className="font-bold">Royal Blue (Primary)</p>
            <p className="text-[10px] text-blue-200 mt-2 font-mono">#1E3A8A</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#2563eb] text-white shadow-sm">
            <p className="font-bold">Brand Blue</p>
            <p className="text-[10px] text-blue-200 mt-2 font-mono">#2563EB</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#10b981] text-white shadow-sm">
            <p className="font-bold">Energetic Green (Secondary)</p>
            <p className="text-[10px] text-emerald-100 mt-2 font-mono">#10B981</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#84cc16] text-slate-950 shadow-sm font-semibold">
            <p className="font-bold">Court Lime (Accent)</p>
            <p className="text-[10px] text-slate-800 mt-2 font-mono">#84CC16</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#f59e0b] text-white shadow-sm">
            <p className="font-bold">Warning Amber</p>
            <p className="text-[10px] text-amber-100 mt-2 font-mono">#F59E0B</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#e11d48] text-white shadow-sm">
            <p className="font-bold">Semantic Error</p>
            <p className="text-[10px] text-rose-100 mt-2 font-mono">#E11D48</p>
          </div>
        </div>
      </section>

      {/* 2. BUTTON VARIANTS (Figma Item 11) */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">2. Button Components &amp; States</h2>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-wrap gap-3 items-center">
          <Button variant="primary">Primary Action</Button>
          <Button variant="secondary">Secondary Action</Button>
          <Button variant="outline">Outline Button</Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="success">Success Button</Button>
          <Button variant="danger">Danger Button</Button>
          <Button variant="primary" isLoading>Loading State</Button>
          <Button variant="primary" disabled>Disabled State</Button>
        </div>
      </section>

      {/* 3. ALL 16+ STATUS BADGES (Figma Item 11) */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">3. Status Badge System (All Lifecycle States)</h2>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-wrap gap-2.5">
          {allStatuses.map((st) => (
            <StatusBadge key={st} status={st} size="md" />
          ))}
        </div>
      </section>

      {/* 4. SKELETONS (Figma Item 63) */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">4. Loading Skeletons</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </section>

      {/* 5. EMPTY STATES (Figma Item 62) */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">5. Contextual Empty States</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <EmptyState
            type="no_requests"
            onAction={() => addToast('info', 'Empty State Triggered', 'New booking wizard can be triggered from here.')}
          />
          <EmptyState
            type="no_repair"
            onAction={() => addToast('info', 'Empty State Triggered', 'New structural repair can be triggered from here.')}
          />
        </div>
      </section>
    </div>
  );
};
