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
} from 'lucide-react';

export const Footer: React.FC = () => {
  const {
    setActiveView,
    setCustomerSubView,
    openLoginWithRole,
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

          {/* Col 4: Platform Portals */}
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
                      openLoginWithRole('CUSTOMER');
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
                  onClick={() => openLoginWithRole('EMPLOYEE')}
                  className="hover:text-blue-400 transition-colors text-left flex items-center gap-1"
                >
                  <ChevronBullet /> Technician Field Ops
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => openLoginWithRole('ADMIN')}
                  className="hover:text-blue-400 transition-colors text-left flex items-center gap-1"
                >
                  <ChevronBullet /> Admin Workshop Console
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

