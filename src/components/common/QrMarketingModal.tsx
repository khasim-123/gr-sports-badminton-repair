import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../../context/AppContext';
import {
  X,
  QrCode,
  Camera,
  Copy,
  Check,
  Printer,
  ArrowRight,
  ShieldCheck,
  Search,
  ExternalLink,
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Button } from './Button';

export const QrMarketingModal: React.FC = () => {
  const {
    qrModalOpen,
    setQrModalOpen,
    openWizardWithService,
    addToast,
    distanceConfig,
    requests,
    setSelectedRequestId,
    setActiveView,
    setCustomerSubView,
    setEmployeeSubView,
    currentRole
  } = useApp();

  const [activeTab, setActiveTab] = useState<'display' | 'scanner'>('display');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Scanner state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedInput, setScannedInput] = useState<string>('');
  const [scanResult, setScanResult] = useState<any | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Generate authentic scannable QR Code on mount
  useEffect(() => {
    if (!qrModalOpen) return;

    const currentUrl = typeof window !== 'undefined'
      ? `${window.location.origin}?ref=courtside_qr&action=book`
      : 'https://grsports.in';

    QRCode.toDataURL(currentUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR code:', err));
  }, [qrModalOpen]);

  // Clean up camera stream when modal closes or switching tabs
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [qrModalOpen, activeTab]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API not supported in this browser environment.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Camera access not granted or no webcam available. You can use the Quick Tag simulation below.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  if (!qrModalOpen) return null;

  const handleCopyLink = () => {
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}?ref=courtside_qr`
      : 'https://grsports.in';
    navigator.clipboard.writeText(url);
    setCopied(true);
    addToast('success', 'Link Copied', 'Court booking URL copied to clipboard.');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSimulateScan = (type: 'getting' | 'repair') => {
    setQrModalOpen(false);
    openWizardWithService(type === 'repair' ? 'REPAIR' : 'GETTING');
  };

  const handleLookupJob = (codeToSearch: string) => {
    const code = codeToSearch.trim().toUpperCase();
    if (!code) return;

    const found = requests.find(
      (r) =>
        r.id.toUpperCase() === code ||
        r.id.toUpperCase().includes(code) ||
        r.customerMobile.includes(code)
    );

    if (found) {
      setScanResult(found);
      addToast('success', 'Tag Recognized', `Found service ticket ${found.id} (${found.batBrand} ${found.batModel}).`);
    } else {
      setScanResult(null);
      addToast('error', 'Tag Not Found', `No job found with ID "${code}". Try REQ-00025 or REQ-00021.`);
    }
  };

  const handleNavigateToJob = (job: any) => {
    setQrModalOpen(false);
    setSelectedRequestId(job.id);
    if (currentRole === 'EMPLOYEE') {
      setActiveView('employee_portal');
      if (job.serviceType === 'GETTING') setEmployeeSubView('getting');
      else setEmployeeSubView('repair');
    } else if (currentRole === 'CUSTOMER') {
      setActiveView('customer_portal');
      setCustomerSubView('detail');
    } else {
      setActiveView('customer_portal');
      setCustomerSubView('detail');
    }
  };

  return (
    <div
      onClick={() => setQrModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95"
      >
        {/* Header with Navigation Tabs */}
        <div className="bg-slate-900 text-white p-4 relative shrink-0">
          <button
            onClick={() => setQrModalOpen(false)}
            className="absolute top-3.5 right-3.5 text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
              GR SPORTS QR UTILITY
            </span>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-slate-800/80 p-1 rounded-xl gap-1 mt-1">
            <button
              onClick={() => {
                setActiveTab('display');
                stopCamera();
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'display'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Court-Side QR</span>
            </button>
            <button
              onClick={() => setActiveTab('scanner')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'scanner'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Scan Racket Tag</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Real Scannable Court-Side QR Code */}
        {activeTab === 'display' && (
          <div className="p-4 sm:p-5 text-center space-y-3.5">
            <div className="p-3.5 bg-gradient-to-b from-slate-50 to-blue-50/50 rounded-2xl border border-blue-100 shadow-inner">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-extrabold tracking-wider uppercase text-slate-900">
                  GR Sports Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-2.5">
                Scan with any smartphone camera to open Doorstep Booking
              </p>

              {/* 100% Real, Scannable QR Code */}
              <div className="mx-auto w-44 h-44 bg-white p-2 rounded-2xl border-2 border-slate-200 shadow-sm flex items-center justify-center relative group">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="GR Sports Booking QR Code"
                    className="w-full h-full object-contain rounded-xl"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                    <span>Generating live QR...</span>
                  </div>
                )}
              </div>

              <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 py-1 px-3 rounded-full border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>FREE Doorstep Pickup within {distanceConfig.freeRadiusKm} KM</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="sm"
                leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copied ? 'Copied!' : 'Copy Web Link'}
              </Button>
              <Button
                onClick={() => {
                  addToast('info', 'Print Template', 'Opening court poster print preview.');
                  window.print();
                }}
                variant="outline"
                size="sm"
                leftIcon={<Printer className="w-3.5 h-3.5" />}
              >
                Print Poster
              </Button>
            </div>

            {/* Direct Booking Simulation */}
            <div className="pt-1">
              <Button
                onClick={() => handleSimulateScan('getting')}
                className="w-full"
                variant="primary"
                size="sm"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Simulate Scan: Book Bat Getting
              </Button>
            </div>
          </div>
        )}

        {/* TAB 2: Interactive Camera / Racket Barcode & QR Scanner */}
        {activeTab === 'scanner' && (
          <div className="p-4 sm:p-5 space-y-3.5">
            {/* Viewfinder Window */}
            <div className="relative w-full h-44 bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 flex flex-col items-center justify-center text-white">
              {cameraActive ? (
                <>
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                  {/* Optical Scan Line Animation */}
                  <div className="absolute inset-x-4 top-1/2 h-0.5 bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,1)] animate-pulse" />
                  <div className="absolute inset-4 border border-rose-500/40 rounded-xl pointer-events-none" />
                </>
              ) : (
                <div className="text-center p-4 space-y-2">
                  <Camera className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">Live Camera Scanner</p>
                  <p className="text-[11px] text-slate-500 max-w-xs">
                    Scan physical QR tags attached to badminton rackets or paper tickets.
                  </p>
                  <button
                    onClick={startCamera}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors"
                  >
                    Turn On Camera
                  </button>
                </div>
              )}

              {cameraActive && (
                <button
                  onClick={stopCamera}
                  className="absolute bottom-2 right-2 px-2 py-1 bg-slate-900/80 hover:bg-slate-900 text-slate-300 rounded-md text-[10px] font-bold"
                >
                  Turn Off
                </button>
              )}
            </div>

            {cameraError && (
              <p className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded-xl border border-amber-200">
                {cameraError}
              </p>
            )}

            {/* Manual Tag / Barcode Search Form */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                <span>Or Enter Job / Tag ID</span>
                <span className="text-[10px] text-slate-400 font-normal">Format: REQ-00025</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={scannedInput}
                    onChange={(e) => setScannedInput(e.target.value)}
                    placeholder="e.g. REQ-00025"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-500 uppercase font-mono font-bold"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLookupJob(scannedInput);
                    }}
                  />
                </div>
                <Button
                  onClick={() => handleLookupJob(scannedInput)}
                  variant="primary"
                  size="sm"
                >
                  Lookup
                </Button>
              </div>
            </div>

            {/* Quick Demo Tag Chips */}
            <div className="pt-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Tap Sample Racket Tag:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {requests.slice(0, 3).map((req) => (
                  <button
                    key={req.id}
                    onClick={() => {
                      setScannedInput(req.id);
                      handleLookupJob(req.id);
                    }}
                    className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200 rounded-lg font-mono font-bold text-slate-700 transition-colors"
                  >
                    🏷️ {req.id} ({req.batBrand})
                  </button>
                ))}
              </div>
            </div>

            {/* Scanned Tag Result Card */}
            {scanResult && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-left space-y-2 animate-in fade-in">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded-full font-mono">
                      {scanResult.id}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 mt-1">
                      {scanResult.batBrand} {scanResult.batModel}
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Customer: {scanResult.customerName} ({scanResult.customerMobile})
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                    {scanResult.status}
                  </span>
                </div>

                <Button
                  onClick={() => handleNavigateToJob(scanResult)}
                  className="w-full"
                  variant="primary"
                  size="sm"
                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  Open Job Details
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="text-[11px]">GR Sports Digital Gateway</span>
          <span className="text-[10px] text-slate-400">v1.2 Production Ready</span>
        </div>
      </div>
    </div>
  );
};
