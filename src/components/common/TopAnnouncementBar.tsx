import React from 'react';
import { Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TopAnnouncementBar: React.FC = () => {
  const { setActiveView } = useApp();

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
    <div className="w-full bg-yellow-400 text-yellow-900 py-3 px-6 flex items-center justify-between text-sm font-bold leading-none overflow-x-hidden relative">
      {/* Left: Brand tag + clickable category links */}
      <div className="flex items-center gap-0 shrink-0">
        <span className="font-black text-yellow-900 tracking-widest text-base mr-3">GR SPORTS</span>
        <span className="text-yellow-800 opacity-40 mr-3 text-lg">|</span>
        <div className="hidden sm:flex items-center gap-1">
          {navItems.map((item, i) => (
            <React.Fragment key={item.label}>
              {i > 0 && <span className="opacity-30 mx-1.5 text-base">·</span>}
              <button
                onClick={() => scrollToSection(item.id)}
                className="px-3 py-1 rounded-lg hover:bg-yellow-500/60 active:bg-yellow-600/40 transition-colors text-yellow-900 font-bold text-sm"
              >
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right / Center: Promo message */}
      <div className="flex items-center gap-2 text-yellow-900 font-bold text-sm whitespace-nowrap">
        <Truck className="w-4 h-4 shrink-0" />
        <span>Free Pickup within 10 KM — Zero Advance Payment</span>
      </div>
    </div>
  );
};
