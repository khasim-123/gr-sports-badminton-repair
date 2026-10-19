import React from 'react';
import { Truck, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TopAnnouncementBar: React.FC = () => {
  const { openAuthModal, isLoggedIn } = useApp();

  return (
    <div className="w-full bg-yellow-400 text-yellow-900 py-1.5 px-4 flex items-center justify-between text-[11px] font-semibold leading-none overflow-x-hidden relative">
      {/* Left: Brand tag + service category links */}
      <div className="flex items-center gap-0 shrink-0">
        <span className="font-black text-yellow-900 tracking-wide mr-2">GR SPORTS</span>
        <span className="text-yellow-800 opacity-40 mr-2">|</span>
        <div className="hidden sm:flex items-center gap-3 text-yellow-800">
          <span className="hover:text-yellow-900 cursor-default transition-colors">Badminton</span>
          <span className="opacity-40">·</span>
          <span className="hover:text-yellow-900 cursor-default transition-colors">Stringing</span>
          <span className="opacity-40">·</span>
          <span className="hover:text-yellow-900 cursor-default transition-colors">Repair</span>
          <span className="opacity-40">·</span>
          <span className="hover:text-yellow-900 cursor-default transition-colors">Doorstep Delivery</span>
        </div>
      </div>

      {/* Center: Promo message (absolutely centred within the bar) */}
      <div className="hidden sm:flex items-center gap-1.5 text-yellow-900 font-bold absolute left-1/2 -translate-x-1/2 pointer-events-none">
        <Truck className="w-3.5 h-3.5 shrink-0" />
        <span>Free Pickup within 10 KM — Zero Advance Payment</span>
      </div>

      {/* Right: Login / Register */}
      {!isLoggedIn && (
        <button
          onClick={() => openAuthModal('CUSTOMER')}
          className="flex items-center gap-1.5 text-yellow-900 hover:text-yellow-950 transition-colors shrink-0 font-bold"
        >
          <User className="w-3.5 h-3.5 shrink-0" />
          <span>Login / Register</span>
        </button>
      )}
      {isLoggedIn && <div className="w-32" />}
    </div>
  );
};
