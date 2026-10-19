import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, ShoppingBag, Wrench, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface BannerSlide {
  id: string;
  type: 'image' | 'custom_tshirt';
  title: string;
  subtitle?: string;
  desktopImg?: string;
  mobileImg?: string;
  alt: string;
  ctaText: string;
  ctaAction: () => void;
}

export const HeroBannerCarousel: React.FC = () => {
  const { openWizardWithService, setActiveView } = useApp();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const scrollToServices = () => {
    const el = document.getElementById('services') || document.getElementById('quick-booking');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const slides: BannerSlide[] = [
    {
      id: 'yonex-pro-rackets',
      type: 'image',
      title: 'Yonex Pro Rackets Restocked',
      alt: 'Yonex Pro Rackets - Restocked with Free Stringing',
      desktopImg: 'https://badmintonoutlet.in/media/wysiwyg/Yonex-Backinstock_1_.jpg',
      mobileImg: 'https://badmintonoutlet.in/media/wysiwyg/M-Yonex-Backinstock_2_.jpg',
      ctaText: 'Book Pro Stringing',
      ctaAction: () => openWizardWithService('GETTING'),
    },
    {
      id: 'gr-pro-tshirts',
      type: 'custom_tshirt',
      title: 'Official GR Sports Badminton T-Shirts',
      subtitle: 'Tournament-Grade Breathable Quick-Dry Polyester • Custom Player Name Printing',
      alt: 'Badminton Performance T-Shirts',
      ctaText: 'Explore T-Shirts & Gear',
      ctaAction: () => scrollToServices(),
    },
    {
      id: 'lining-blade-rackets',
      type: 'image',
      title: 'Li-Ning Bladex Rackets Collection',
      alt: 'Li-Ning Bladex Pro Rackets',
      desktopImg: 'https://badmintonoutlet.in/media/wysiwyg/Blade.jpg',
      mobileImg: 'https://badmintonoutlet.in/media/wysiwyg/M-Blade.jpg',
      ctaText: 'Custom String & Repair',
      ctaAction: () => openWizardWithService('REPAIR'),
    },
    {
      id: 'yonex-blaze-5i',
      type: 'image',
      title: 'Yonex Blaze 5i Lightweight Power Rackets',
      alt: 'Yonex Blaze 5i Racket Promotion',
      desktopImg: 'https://badmintonoutlet.in/media/wysiwyg/Yonex-Blaze5i.jpg',
      mobileImg: 'https://badmintonoutlet.in/media/wysiwyg/M-Yonex-Blaze5i.jpg',
      ctaText: 'Get Stringing Within 10 KM',
      ctaAction: () => openWizardWithService('GETTING'),
    },
  ];

  // Auto-play timer
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPaused, slides.length]);

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) handleNext();
    if (diff < -50) handlePrev();
    touchStartX.current = null;
  };

  return (
    <div
      className="relative w-full bg-slate-950 overflow-hidden select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides Container */}
      <div className="relative w-full aspect-[21/9] sm:aspect-[2.55/1] max-h-[520px] overflow-hidden">
        {slides.map((slide, index) => {
          const isActive = index === currentSlide;

          return (
            <div
              key={slide.id}
              className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
                isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              {slide.type === 'image' ? (
                <div
                  className="w-full h-full cursor-pointer relative group"
                  onClick={slide.ctaAction}
                >
                  <picture className="w-full h-full block">
                    <source media="(min-width: 640px)" srcSet={slide.desktopImg} />
                    <img
                      src={slide.mobileImg || slide.desktopImg}
                      alt={slide.alt}
                      className="w-full h-full object-cover object-center"
                    />
                  </picture>

                  {/* Subtle interactive hover overlay */}
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />

                  {/* Mobile Quick Action Pill */}
                  <div className="sm:hidden absolute bottom-3 right-3 bg-yellow-400 text-slate-950 text-xs font-black px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                    <span>{slide.ctaText}</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              ) : (
                /* Custom T-Shirts Slide with Badminton Performance Styling */
                <div
                  onClick={slide.ctaAction}
                  className="w-full h-full bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 flex items-center justify-between px-6 sm:px-16 py-8 relative cursor-pointer group overflow-hidden"
                >
                  {/* Atmospheric Glow */}
                  <div className="absolute -top-20 -left-20 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-yellow-500/20 rounded-full blur-3xl pointer-events-none" />

                  {/* Left Column: Text & CTA */}
                  <div className="z-10 max-w-xl space-y-3 sm:space-y-4 text-left">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 text-xs font-bold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      <span>New Arrival • Limited Edition</span>
                    </div>

                    <h2 className="text-xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
                      GR Sports <span className="text-yellow-400">Pro Badminton</span> T-Shirts
                    </h2>

                    <p className="text-xs sm:text-base text-slate-300 font-medium leading-relaxed hidden xs:block">
                      {slide.subtitle}
                    </p>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          slide.ctaAction();
                        }}
                        className="bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-slate-950 font-black text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-yellow-400/20 transition-all flex items-center gap-2"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>{slide.ctaText}</span>
                      </button>

                      <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-300 font-semibold bg-emerald-900/40 border border-emerald-700/50 px-3 py-2 rounded-xl">
                        <span>✨ Free 10 KM Delivery</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Featured T-Shirt Showcase */}
                  <div className="hidden sm:flex items-center gap-4 z-10 pr-4 shrink-0">
                    <div className="relative group-hover:scale-105 transition-transform duration-500">
                      <img
                        src="https://badmintonoutlet.in/media/catalog/product/cache/c5b0e6136a6dd7f7d91d8b889ed40f35/b/t/btshrt007_1.jpg"
                        alt="Badminton T-Shirt Blue"
                        className="w-32 sm:w-44 md:w-52 h-auto object-contain rounded-2xl drop-shadow-2xl border border-white/10"
                      />
                      <span className="absolute -top-2 -right-2 bg-yellow-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-md">
                        ₹499
                      </span>
                    </div>

                    <div className="hidden md:block relative -ml-12 group-hover:scale-105 transition-transform duration-500 delay-75">
                      <img
                        src="https://badmintonoutlet.in/media/catalog/product/cache/c5b0e6136a6dd7f7d91d8b889ed40f35/b/t/btshrt001_1.jpg"
                        alt="Badminton T-Shirt Black"
                        className="w-36 md:w-48 h-auto object-contain rounded-2xl drop-shadow-2xl border border-white/10 opacity-90"
                      />
                      <span className="absolute -top-2 -right-2 bg-emerald-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-md">
                        Pro Dry-Fit
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation Arrow: Prev */}
      <button
        type="button"
        onClick={handlePrev}
        aria-label="Previous slide"
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center transition-all border border-white/20 active:scale-90"
      >
        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* Navigation Arrow: Next */}
      <button
        type="button"
        onClick={handleNext}
        aria-label="Next slide"
        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center transition-all border border-white/20 active:scale-90"
      >
        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* Pagination Dots */}
      <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setCurrentSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
            className={`transition-all duration-300 rounded-full ${
              index === currentSlide
                ? 'w-7 sm:w-9 h-2 sm:h-2.5 bg-yellow-400 shadow-md'
                : 'w-2 sm:w-2.5 h-2 sm:h-2.5 bg-white/50 hover:bg-white/80'
            }`}
          />
        ))}
      </div>

      {/* Brand Logos Ribbon (matching badmintonoutlet.in) */}
      <div className="w-full bg-white border-b border-slate-200 py-3 sm:py-4 px-4 shadow-xs relative z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
          {[
            { name: 'Yonex', img: 'https://badmintonoutlet.in/media/wysiwyg/smartwave/porto/category/s-yonex.jpg' },
            { name: 'Li-Ning', img: 'https://badmintonoutlet.in/media/wysiwyg/smartwave/porto/category/b-lining.jpg' },
            { name: 'Victor', img: 'https://badmintonoutlet.in/media/wysiwyg/smartwave/porto/category/b-victor.jpg' },
            { name: 'Apacs', img: 'https://badmintonoutlet.in/media/wysiwyg/smartwave/porto/category/b-apacs.jpg' },
            { name: 'Hundred', img: 'https://badmintonoutlet.in/media/wysiwyg/smartwave/porto/category/b-hundred.jpg' },
            { name: 'Babolat', img: 'https://badmintonoutlet.in/media/wysiwyg/smartwave/porto/category/b-babolat.jpg' },
          ].map((brand) => (
            <div
              key={brand.name}
              className="shrink-0 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity px-2 sm:px-4"
            >
              <img
                src={brand.img}
                alt={brand.name}
                className="h-6 sm:h-8 md:h-9 w-auto object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
