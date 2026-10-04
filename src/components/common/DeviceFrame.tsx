import React from 'react';
import { useApp } from '../../context/AppContext';
import { Monitor, Tablet, Smartphone, Maximize2, X } from 'lucide-react';

export const DeviceFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { deviceViewport, setDeviceViewport } = useApp();

  if (deviceViewport === 'responsive') {
    return <>{children}</>;
  }

  let widthClass = 'w-full';
  let deviceName = 'Responsive Viewport';
  let deviceRes = '100% Fluid';

  if (deviceViewport === 'desktop') {
    widthClass = 'max-w-[1440px]';
    deviceName = 'Desktop Frame';
    deviceRes = '1440 × 900';
  } else if (deviceViewport === 'tablet') {
    widthClass = 'max-w-[1024px]';
    deviceName = 'Tablet Frame (iPad Pro)';
    deviceRes = '1024 × 768';
  } else if (deviceViewport === 'mobile') {
    widthClass = 'max-w-[390px]';
    deviceName = 'Mobile First (iPhone 14/15)';
    deviceRes = '390 × 844';
  }

  return (
    <div className="min-h-screen bg-slate-950 py-6 px-2 sm:px-4 flex flex-col items-center justify-start">
      {/* Device Toolbar */}
      <div className="w-full max-w-5xl mb-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 px-4 flex items-center justify-between text-white text-xs">
        <div className="flex items-center gap-2">
          {deviceViewport === 'desktop' && <Monitor className="w-4 h-4 text-blue-400" />}
          {deviceViewport === 'tablet' && <Tablet className="w-4 h-4 text-blue-400" />}
          {deviceViewport === 'mobile' && <Smartphone className="w-4 h-4 text-emerald-400" />}
          <span className="font-bold text-slate-200">{deviceName}</span>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-mono">
            {deviceRes}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDeviceViewport('responsive')}
            className="flex items-center gap-1 text-[11px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded-lg transition-colors"
          >
            <Maximize2 className="w-3 h-3" /> Full Width Fluid View
          </button>
        </div>
      </div>

      {/* Device Bezel Simulator */}
      <div
        className={`${widthClass} w-full bg-white rounded-3xl shadow-2xl border-4 border-slate-800 overflow-hidden transition-all duration-300 relative`}
      >
        {/* Device camera notch simulation for mobile */}
        {deviceViewport === 'mobile' && (
          <div className="w-28 h-4 bg-slate-800 rounded-b-xl mx-auto mb-1 flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-black rounded-full" />
          </div>
        )}

        {/* Scaled App Content */}
        <div className="max-h-[92vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
