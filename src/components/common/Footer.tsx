import React from 'react';
import { useApp } from '../../context/AppContext';
import { GRSportsLogo } from './GRSportsLogo';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  Truck,
  QrCode,
  Zap,
  Wrench,
} from 'lucide-react';

export const Footer: React.FC = () => {
  const {
    setActiveView,
    setCustomerSubView,
    openLoginWithRole,
    openAuthModal,
    setQrModalOpen,
    distanceConfig,
    isLoggedIn,
  } = useApp();

  const scrollToSection = (sectionId: string) => {
    setActiveView('landing');
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-800/80 pt-16 pb-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Top Section: Brand Overview & Trust Badges */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-12 border-b border-slate-800/80">
          {/* Col 1 & 2: Brand Identity */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <GRSportsLogo size="md" />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              India's premier high-precision badminton racquet servicing platform. Powered by constant-pull electronic stringing machines and aerospace-grade carbon fiber composite restoration.
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-emerald-400 font-semibold">
                <Truck className="w-3.5 h-3.5" />
                <span>{distanceConfig?.freeRadiusKm ?? 15} KM Free Doorstep Pickup</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-amber-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>7-Day Structural SLA</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-blue-400 font-semibold">
                <Zap className="w-3.5 h-3.5" />
                <span>Zero Advance Payment</span>
              </div>
            </div>
          </div>

          {/* Col 3: Services */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">
              Servicing &amp; Repair
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('services')}
                  className="hover:text-blue-400 transition-colors text-left flex items-center gap-1"
                >
                  <ChevronBullet /> Bat Getting (Electronic)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('services')}
                  className="hover:text-blue-400 transition-colors text-left flex items-center gap-1"
                >
                  <ChevronBullet /> Carbon Composite Splice
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('services')}
                  className="hover:text-blue-400 transition-colors text-left flex items-center gap-1"
                >
                  <ChevronBullet /> Yonex BG65 / BG80 / Nanogy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('services')}
                  className="hover:text-blue-400 transition-colors text-left flex items-center gap-1"
                >
                  <ChevronBullet /> Grommet Replacement
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('pricing-sla')}
                  className="hover:text-blue-400 transition-colors text-left flex items-center gap-1"
                >
                  <ChevronBullet /> 7-Day Guarantee Terms
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Platform Portals & Staff Access */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">
              Platform Portals
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    if (isLoggedIn) {
                      setActiveView('customer_portal');
                      setCustomerSubView('dashboard');
                    } else {
                      openAuthModal('CUSTOMER');
                    }
                  }}
                  className="hover:text-blue-400 transition-colors text-left flex items-center gap-1"
                >
                  <ChevronBullet /> Customer Portal
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('distance-map')}
                  className="hover:text-blue-400 transition-colors text-left flex items-center gap-1"
                >
                  <ChevronBullet /> 15 KM Free Radius Map
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setQrModalOpen(true)}
                  className="hover:text-blue-400 transition-colors text-left flex items-center gap-1.5 text-blue-300 font-semibold"
                >
                  <QrCode className="w-3.5 h-3.5" /> Court QR Code Scanner
                </button>
              </li>
            </ul>

            {/* Dedicated Popup Action Buttons for Staff & Admin */}
            <div className="pt-2.5 space-y-2 border-t border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Staff &amp; Management Access
              </span>
              <button
                type="button"
                onClick={() => openAuthModal('EMPLOYEE')}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-emerald-950/60 border border-slate-800 hover:border-emerald-600/50 text-emerald-400 font-bold text-xs flex items-center justify-between transition-all group shadow-2xs"
                title="Click to open Employee Login popup"
              >
                <span className="flex items-center gap-2">
                  <Wrench className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Employee Login</span>
                </span>
                <span className="text-[10px] text-slate-500 group-hover:text-emerald-400">Ops Portal →</span>
              </button>

              <button
                type="button"
                onClick={() => openAuthModal('ADMIN')}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-purple-950/60 border border-slate-800 hover:border-purple-600/50 text-purple-400 font-bold text-xs flex items-center justify-between transition-all group shadow-2xs"
                title="Click to open Admin Login popup"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  <span>Admin Login</span>
                </span>
                <span className="text-[10px] text-slate-500 group-hover:text-purple-400">Console →</span>
              </button>
            </div>
          </div>

          {/* Col 5: Contact & Workshop Concierge */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">
              Workshop &amp; Support
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span className="text-slate-300">
                  {distanceConfig?.shopLocationName ?? 'Central Workshop Hub'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-300">Mon - Sun: 7:00 AM – 9:00 PM</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                <a href="tel:+919876543210" className="hover:text-white transition-colors text-slate-300">
                  +91 98765 43210
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-400 shrink-0" />
                <a href="mailto:support@grsports.in" className="hover:text-white transition-colors text-slate-300">
                  support@grsports.in
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Terms */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 pt-2">
          <p>© {new Date().getFullYear()} GR Sports. All rights reserved. Professional badminton racquet stringing &amp; carbon composite repair.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <button
              type="button"
              onClick={() => scrollToSection('pricing-sla')}
              className="hover:text-white transition-colors"
            >
              7-Day SLA Policy
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => scrollToSection('distance-map')}
              className="hover:text-white transition-colors"
            >
              Free Radius Rules
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => scrollToSection('faq')}
              className="hover:text-white transition-colors"
            >
              FAQ
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

const ChevronBullet: React.FC = () => (
  <span className="text-blue-500 font-bold mr-1">›</span>
);
export default Footer;

