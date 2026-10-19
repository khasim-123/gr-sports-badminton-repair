import React from 'react';
import { Truck, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TopAnnouncementBar: React.FC = () => {
  const { openAuthModal, isLoggedIn, setActiveView } = useApp();

  const scrollToSection = (sectionId: string) => {
    setActiveView('landing');
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  const navItems = [
    { label: '🏸 Badminton', id: 'services' },
    { label: '👕 T-Shirts', id: 'services' },
  ];

  return (
    <div className="w-full bg-yellow-400 text-yellow-900 py-1.5 px-4 flex items-center justify-between text-[11px] font-semibold leading-none overflow-x-hidden relative">
      {/* Left: Brand tag + clickable category links */}
      <div className="flex items-center gap-0 shrink-0">
        <span className="font-black text-yellow-900 tracking-wide mr-2">GR SPORTS</span>
        <span className="text-yellow-800 opacity-40 mr-2">|</span>
        <div className="hidden sm:flex items-center gap-1">
          {navItems.map((item, i) => (
            <React.Fragment key={item.label}>
              {i > 0 && <span className="opacity-30 mx-1">·</span>}
              <button
                onClick={() => scrollToSection(item.id)}
                className="px-2 py-0.5 rounded-md hover:bg-yellow-500/60 active:bg-yellow-600/40 transition-colors text-yellow-900 font-semibold"
              >
                {item.label}
              </button>
            </React.Fragment>
          ))}
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
