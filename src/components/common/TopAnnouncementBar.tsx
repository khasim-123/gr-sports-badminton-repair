import React from 'react';
import { CalendarClock, MapPin, Shirt, Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { openStoreSection } from '../../utils/storeNavigation';
import { fullAddress, localityOf, useShopSettings } from '../../hooks/useShopSettings';

/**
 * Slim bar above the navbar on customer-facing app screens (the landing page has its own header).
 * Store links open the matching section of the shop's website; the address comes from the shop settings and the promise text comes from the
 * live pickup configuration.
 */
export const TopAnnouncementBar: React.FC = () => {
  const { setActiveView, distanceConfig } = useApp();
  const shop = useShopSettings();
  const shortAddress = [shop.addressLine.split(',')[0].trim(), localityOf(shop)].filter(Boolean).join(', ');

  const links = [
    { label: 'Strings', view: 'strings' },
    { label: 'Rackets', view: 'rackets' },
  ];

  return (
    <div className="w-full bg-ink text-white/80 print:hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-[36px] flex items-center justify-between gap-3 text-[13px]">
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1.5" title={fullAddress(shop)}>
            <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
            {shortAddress}
          </span>
          <span className="text-white/25" aria-hidden="true">|</span>
          {links.map((link) => (
            <button
              key={link.view}
              type="button"
              onClick={() => openStoreSection(setActiveView, link.view)}
              className="min-h-[32px] hover:text-white underline-offset-4 hover:underline transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 min-w-0 flex-1 md:flex-none justify-between md:justify-end">
          <p className="flex items-center gap-2 min-w-0 py-1.5">
            <Truck className="w-4 h-4 shrink-0 text-accent" />
            <span className="truncate">
              Free pickup and delivery within {distanceConfig.freeRadiusKm} km<span className="hidden sm:inline"> · Pay when it comes back</span>
            </span>
          </p>
          <a
            href="/tshirts"
            onClick={(e) => {
              e.preventDefault();
              openStoreSection(setActiveView, 'tshirts');
            }}
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 font-semibold text-white hover:text-accent"
          >
            <Shirt className="w-4 h-4 text-accent" aria-hidden="true" />
            T-shirts
          </a>
          <a
            href="/courts"
            onClick={(e) => {
              e.preventDefault();
              openStoreSection(setActiveView, 'courts');
            }}
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 font-semibold text-white hover:text-accent"
          >
            <CalendarClock className="w-4 h-4 text-accent" aria-hidden="true" />
            Courts
          </a>
        </div>
      </div>
    </div>
  );
};
