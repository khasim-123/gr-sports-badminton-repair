import React from 'react';
import { Sparkles, ShoppingBag, Lock, BellRing, ArrowLeft } from 'lucide-react';
import { Button } from '../common/Button';
import { useApp } from '../../context/AppContext';

export const Phase2Placeholder: React.FC = () => {
  const { setActiveView } = useApp();

  const comingSoonItems = [
    { title: 'Tournament Feather Shuttlecocks', brand: 'Yonex AS-50 / Aerosensa', status: 'In Scope for Phase 2' },
    { title: 'Pro Strings & Reels', brand: 'BG80 Power / Exbolt 65 / Nanogy 98', status: 'In Scope for Phase 2' },
    { title: 'High-Tack Polyurethane Grips', brand: 'Yonex AC102EX Super Grap (30-Pack)', status: 'In Scope for Phase 2' },
    { title: 'Badminton Court Shoes', brand: 'Yonex Power Cushion / Li-Ning Blade Pro', status: 'In Scope for Phase 2' },
    { title: 'Thermal Racquet Bags & Backpacks', brand: 'Pro 9-Racquet Tournament Series', status: 'In Scope for Phase 2' },
    { title: 'Online UPI / Card Checkout & Cart', brand: 'Payment Gateway Integration', status: 'In Scope for Phase 2' },
  ];

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <button
          onClick={() => setActiveView('landing')}
          className="text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Phase 1 Application
        </button>
        <span className="text-[10px] font-mono uppercase bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">
          FIGMA FILE PAGE 16 — FUTURE EXPANSION
        </span>
      </div>

      <div className="text-center max-w-xl mx-auto space-y-3">
        <div className="w-16 h-16 rounded-3xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto shadow-sm">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
          Badminton Gear &amp; Equipment Pro Shop
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Phase 1 is strictly focused on <b>Badminton Bat Getting &amp; Structural Repair</b> with doorstep pickup and manual payment collection. E-commerce and online payments are reserved for Phase 2.
        </p>
      </div>

      {/* Grid of future module previews */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {comingSoonItems.map((item, idx) => (
          <div
            key={idx}
            className="p-5 rounded-3xl border border-slate-200 bg-white/70 relative overflow-hidden group shadow-2xs"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                Coming Soon
              </span>
              <Lock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 mt-2">{item.title}</h3>
            <p className="text-xs text-slate-500 mt-1">{item.brand}</p>
            <p className="text-[11px] text-blue-700 font-semibold mt-3">{item.status}</p>
          </div>
        ))}
      </div>

      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 text-center max-w-md mx-auto text-xs text-blue-900">
        <p className="font-bold mb-1">Architecture Ready for Phase 2</p>
        <p className="text-[11px] text-blue-800 leading-relaxed">
          Product catalogue schemas, cart states, and payment gateway adapters are isolated in architectural interfaces to ensure zero disruption to core Phase 1 getting and repair operations.
        </p>
      </div>
    </div>
  );
};
