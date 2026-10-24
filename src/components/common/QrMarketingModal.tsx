import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../../context/AppContext';
import { X, QrCode, Copy, Check, Share2, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { useShopSettings } from '../../hooks/useShopSettings';

/**
 * "Share GR Sports" dialog: a scannable QR code + link to this website, so a customer can pass the
 * booking site on to a friend or teammate. (Opened from the footer.)
 */
export const QrMarketingModal: React.FC = () => {
  const { qrModalOpen, setQrModalOpen, openWizardWithService, addToast, distanceConfig } = useApp();
  const shop = useShopSettings();

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/?utm_source=qr_share` : '';
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!qrModalOpen || !shareUrl) return;
    QRCode.toDataURL(shareUrl, { width: 240, margin: 1, color: { dark: '#0f172a', light: '#ffffff' }, errorCorrectionLevel: 'M' })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR code:', err));
  }, [qrModalOpen, shareUrl]);

  useEffect(() => {
    if (!qrModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQrModalOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [qrModalOpen, setQrModalOpen]);

  if (!qrModalOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      addToast('success', 'Link copied', `The ${shop.name} booking link is on your clipboard.`);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      addToast('error', 'Could not copy', `Copy this link instead: ${shareUrl}`);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: `${shop.name} — racket stringing & repair`,
        text: `Badminton racket stringing & repair with free doorstep pickup within ${distanceConfig.freeRadiusKm} KM.`,
        url: shareUrl,
      });
    } catch {
      // cancelled by the user
    }
  };

  return (
    <div
      onClick={() => setQrModalOpen(false)}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-qr-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[calc(100dvh-1.5rem)] animate-in zoom-in-95"
      >
        <div className="bg-slate-900 text-white px-5 py-4 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h3 id="share-qr-title" className="text-base font-bold flex items-center gap-2">
              <QrCode className="w-4 h-4 text-emerald-400" /> Share {shop.name}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">Scan with a phone camera to open our booking website.</p>
          </div>
          <button
            type="button"
            onClick={() => setQrModalOpen(false)}
            className="w-10 h-10 -mr-2 -mt-1 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="mx-auto w-48 h-48 bg-white p-2 rounded-2xl border-2 border-slate-200 flex items-center justify-center">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`QR code linking to the ${shop.name} website`} className="w-full h-full object-contain" />
            ) : (
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            )}
          </div>
          <p className="text-center text-[11px] font-mono text-slate-500 break-all">{shareUrl}</p>

          <div className={`grid gap-2 ${canShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <Button
              onClick={handleCopyLink}
              variant="outline"
              size="sm"
              className="min-h-[40px]"
              leftIcon={copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            {canShare && (
              <Button onClick={handleShare} variant="outline" size="sm" className="min-h-[40px]" leftIcon={<Share2 className="w-4 h-4" />}>
                Share
              </Button>
            )}
          </div>

          <Button
            onClick={() => {
              setQrModalOpen(false);
              openWizardWithService('GETTING');
            }}
            className="w-full min-h-[40px]"
            variant="primary"
            size="sm"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Book a service yourself
          </Button>
        </div>
      </div>
    </div>
  );
};
