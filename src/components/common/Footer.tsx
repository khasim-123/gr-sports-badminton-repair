import React from 'react';
import { useApp } from '../../context/AppContext';
import { GRSportsLogo } from './GRSportsLogo';
import { MapPin, Phone, Mail, Truck, QrCode, Wrench, ShieldCheck, Clock, Wallet } from 'lucide-react';
import { contentService } from '../../services/contentService';
import { openStoreSection } from '../../utils/storeNavigation';
import { cityOf, fullAddress, mapsHref, phoneDisplay, telHref, useShopSettings } from '../../hooks/useShopSettings';

/** openWeekdays uses Monday = 0 … Sunday = 6 (backend convention). */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** [0,1,2,3,4,5] -> "Mon–Sat"; [0,2,4] -> "Mon, Wed, Fri". */
function describeWeekdays(days: number[]): string {
  const sorted = Array.from(new Set(days.filter((d) => d >= 0 && d <= 6))).sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  if (sorted.length === 7) return 'Every day';
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (contiguous && sorted.length > 2) return `${WEEKDAYS[sorted[0]]}–${WEEKDAYS[sorted[sorted.length - 1]]}`;
  return sorted.map((d) => WEEKDAYS[d]).join(', ');
}

/** Footer for the customer-facing app screens (the landing page has its own footer). */
export const Footer: React.FC = () => {
  const {
    setActiveView,
    setCustomerSubView,
    openAuthModal,
    openWizardWithService,
    setQrModalOpen,
    distanceConfig,
    isLoggedIn,
    currentRole,
  } = useApp();
  const shop = useShopSettings();

  // Pickup days / time slots from the live availability settings.
  const [pickupHours, setPickupHours] = React.useState<string>('');
  React.useEffect(() => {
    let cancelled = false;
    contentService
      .getAvailability(7)
      .then((data) => {
        if (cancelled || !data?.settings) return;
        const days = describeWeekdays(data.settings.openWeekdays || []);
        const slots = (data.settings.pickupSlots || []).map((s) => s.replace(/\s*-\s*/, '–')).join(', ');
        setPickupHours([days, slots].filter(Boolean).join(' · '));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const isCustomer = isLoggedIn && currentRole === 'CUSTOMER';
  const goToPortal = (sub: string) => {
    if (!isCustomer) {
      openAuthModal('CUSTOMER');
      return;
    }
    setActiveView('customer_portal');
    setCustomerSubView(sub);
    window.scrollTo({ top: 0 });
  };

  const linkClass = 'hover:text-white transition-colors text-left inline-flex items-center gap-1.5 min-h-[36px]';

  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-800/80 pt-12 pb-8 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-slate-800/80">
          {/* Brand */}
          <div className="space-y-4 sm:col-span-2 lg:col-span-1">
            <GRSportsLogo theme="dark" />
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Badminton racket stringing and repair in {cityOf(shop)}, with doorstep pickup and delivery.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-emerald-400 font-semibold">
                <Truck className="w-3.5 h-3.5" /> Free pickup within {distanceConfig.freeRadiusKm} KM
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-blue-300 font-semibold">
                <Wallet className="w-3.5 h-3.5" /> Pay after delivery (cash / UPI)
              </span>
            </div>
          </div>

          {/* Services */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-white mb-1">Services</h4>
            <ul className="text-xs">
              <li>
                <button type="button" onClick={() => openWizardWithService('GETTING')} className={linkClass}>
                  Book racket stringing
                </button>
              </li>
              <li>
                <button type="button" onClick={() => openWizardWithService('REPAIR')} className={linkClass}>
                  Book a racket repair
                </button>
              </li>
              <li>
                <button type="button" onClick={() => goToPortal('requests')} className={linkClass}>
                  Track my requests
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setQrModalOpen(true)} className={linkClass}>
                  <QrCode className="w-3.5 h-3.5" /> Share our booking link (QR)
                </button>
              </li>
            </ul>
          </div>

          {/* Store */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-white mb-1">{shop.name} Store</h4>
            <ul className="text-xs">
              {[
                { label: 'Rackets', view: 'rackets' },
                { label: 'String catalogue', view: 'strings' },
                { label: 'T-Shirts', view: 'tshirts' },
                { label: 'Store home page', view: 'home' },
              ].map((item) => (
                <li key={item.view}>
                  <button type="button" onClick={() => openStoreSection(setActiveView, item.view)} className={linkClass}>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>

            {!isLoggedIn && (
              <div className="pt-3 mt-2 space-y-2 border-t border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Staff access</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openAuthModal('EMPLOYEE')}
                    className="px-3 min-h-[40px] rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-600/50 text-emerald-400 font-bold text-xs inline-flex items-center gap-2"
                  >
                    <Wrench className="w-3.5 h-3.5" /> Employee login
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthModal('ADMIN')}
                    className="px-3 min-h-[40px] rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-600/50 text-purple-300 font-bold text-xs inline-flex items-center gap-2"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> Admin login
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">Contact the shop</h4>
            <div className="space-y-2.5 text-xs">
              <a
                href={mapsHref(shop)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 text-slate-300 hover:text-white"
              >
                <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>{fullAddress(shop)}</span>
              </a>
              <a href={telHref(shop.phone)} className="flex items-center gap-2 text-slate-300 hover:text-white min-h-[32px]">
                <Phone className="w-4 h-4 text-amber-400 shrink-0" /> {phoneDisplay(shop.phone)}
              </a>
              {shop.email && (
                <a href={`mailto:${shop.email}`} className="flex items-center gap-2 text-slate-300 hover:text-white min-h-[32px] break-all">
                  <Mail className="w-4 h-4 text-purple-400 shrink-0" /> {shop.email}
                </a>
              )}
              {shop.openingHours && (
                <p className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300">Shop hours: {shop.openingHours}</span>
                </p>
              )}
              {pickupHours && (
                <p className="flex items-start gap-2">
                  <Truck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300">Doorstep pickups: {pickupHours}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500">© {new Date().getFullYear()} {shop.name}, {cityOf(shop)}. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
