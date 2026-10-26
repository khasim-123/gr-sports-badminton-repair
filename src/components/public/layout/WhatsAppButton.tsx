import React from 'react';
import { useShop } from '../home/shop';
import { WhatsAppIcon } from '../home/ui';

/** Sticky WhatsApp button on every public page (GR website map: "keep a sticky WhatsApp icon"). */
export const WhatsAppButton: React.FC = () => {
  const SHOP = useShop();
  return (
    <a
      href={SHOP.whatsAppLink(SHOP.greeting('I have a question.'))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with ${SHOP.name} on WhatsApp`}
      title={`Chat with ${SHOP.name} on WhatsApp`}
      className="fixed bottom-4 right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-ink/25 ring-4 ring-white/70 transition-transform duration-150 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sportsBlue motion-reduce:transition-none sm:bottom-6 sm:right-6 print:hidden"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
};
