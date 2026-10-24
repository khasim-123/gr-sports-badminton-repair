import React from 'react';
import { Navigation, Compass, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatINR } from '../../utils/format';
import { localityOf, useShopSettings } from '../../hooks/useShopSettings';

interface MapSimulationProps {
  distanceKm: number;
  /** e.g. "From your location" / "Entered by you" — shown under the distance. */
  sourceLabel?: string;
}

/** Read-only diagram of the pickup distance and the resulting pickup & delivery charge. */
export const MapSimulation: React.FC<MapSimulationProps> = ({ distanceKm, sourceLabel }) => {
  const { distanceConfig, calculateDistanceCharge } = useApp();
  const shop = useShopSettings();
  const calculation = calculateDistanceCharge(distanceKm);
  const maxServiceKm = distanceConfig.maxServiceDistanceKm || 0;
  // Let customers pick a little beyond the pickup area so they see the "outside our area" message.
  const outsideArea = maxServiceKm > 0 && distanceKm > maxServiceKm;
  const isSlab = distanceConfig.pricingMethod === 'SLAB';

  // Diagram coordinates: the shop is the centre (200, 150).
  const center = { x: 200, y: 150 };
  // Scale so the free-pickup circle is always clearly visible (diagram, not to scale).
  const pxPerKm = 70 / Math.max(1, distanceConfig.freeRadiusKm);
  const freeRadiusPx = distanceConfig.freeRadiusKm * pxPerKm;
  
  // Angle for customer pin
  const angle = 0.85; // ~48 degrees
  const customerDistancePx = Math.min(130, Math.max(18, distanceKm * pxPerKm));
  const customerPin = {
    x: center.x + Math.cos(angle) * customerDistancePx,
    y: center.y - Math.sin(angle) * customerDistancePx,
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-800 shadow-md">
      {/* Map Header / Status Bar */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-emerald-400 animate-spin-slow" />
          <span className="text-xs font-semibold text-slate-200">
            Pickup distance &amp; charge
          </span>
        </div>
        <div className="flex items-center gap-2">
          {outsideArea ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <AlertCircle className="w-3.5 h-3.5" /> Outside our {maxServiceKm} KM pickup area
            </span>
          ) : calculation.isFree ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" /> Free within {distanceConfig.freeRadiusKm} KM
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <AlertCircle className="w-3.5 h-3.5" /> Pickup charge {formatINR(calculation.charge)}
            </span>
          )}
        </div>
      </div>

      {/* SVG Canvas Map Display */}
      <div className="relative h-52 sm:h-60 w-full bg-[#0b1329] overflow-hidden select-none">
        {/* Subtle grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px]" />

        <svg className="w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="freeRadiusGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.18" />
              <stop offset="85%" stopColor="#10B981" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.25" />
            </radialGradient>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor={calculation.isFree ? '#10b981' : '#f59e0b'} />
            </linearGradient>
          </defs>

          {/* Free-pickup boundary */}
          <circle
            cx={center.x}
            cy={center.y}
            r={freeRadiusPx}
            fill="url(#freeRadiusGradient)"
            stroke="#10B981"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          {/* Free-pickup label */}
          <text
            x={center.x}
            y={center.y + freeRadiusPx + 14}
            textAnchor="middle"
            fill="#34d399"
            fontSize="10"
            fontWeight="600"
            letterSpacing="0.05em"
          >
            {distanceConfig.freeRadiusKm} KM FREE PICKUP ZONE
          </text>

          {/* Route Connection Path */}
          <line
            x1={center.x}
            y1={center.y}
            x2={customerPin.x}
            y2={customerPin.y}
            stroke="url(#routeGradient)"
            strokeWidth="3"
            strokeDasharray="6 4"
            className="animate-pulse"
          />

          {/* Workshop Center Pin */}
          <g transform={`translate(${center.x - 12}, ${center.y - 24})`}>
            <circle cx="12" cy="24" r="6" fill="#3b82f6" fillOpacity="0.4" className="animate-ping" />
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
              fill="#3b82f6"
            />
          </g>
          <text
            x={center.x}
            y={center.y + 16}
            textAnchor="middle"
            fill="#93c5fd"
            fontSize="10"
            fontWeight="bold"
          >
            {shop.name} ({localityOf(shop)})
          </text>

          {/* Customer Location Pin */}
          <g transform={`translate(${customerPin.x - 12}, ${customerPin.y - 24})`}>
            <circle
              cx="12"
              cy="24"
              r="6"
              fill={calculation.isFree ? '#10b981' : '#f59e0b'}
              fillOpacity="0.4"
            />
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
              fill={calculation.isFree ? '#10b981' : '#f59e0b'}
            />
          </g>
          <text
            x={customerPin.x}
            y={customerPin.y - 28}
            textAnchor="middle"
            fill="#ffffff"
            fontSize="10"
            fontWeight="bold"
          >
            You ({distanceKm} KM)
          </text>
        </svg>

        <span className="absolute bottom-2 right-3 text-[10px] text-slate-500">Diagram, not to scale</span>

        {/* Floating Distance Badge on map */}
        <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/80 text-xs">
          <p className="text-[11px] text-slate-400">About</p>
          <p className="text-base font-extrabold text-white mt-0.5 flex items-center gap-1.5">
            <Navigation className="w-4 h-4 text-emerald-400 rotate-45" />
            {distanceKm} KM
          </p>
          {sourceLabel && <p className="text-[10px] text-slate-400 mt-0.5">{sourceLabel}</p>}
        </div>
      </div>

      {/* Charge breakdown */}
      <div className="p-4 bg-slate-900/90 border-t border-slate-800">
        {/* Pricing Breakdown Card */}
        <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Distance:</span>
            <span className="font-semibold text-white">{distanceKm} KM</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Free radius:</span>
            <span className="font-semibold text-emerald-400">{distanceConfig.freeRadiusKm} KM</span>
          </div>

          {calculation.isFree ? (
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-emerald-400 font-bold">
              <span>Doorstep Pickup & Delivery:</span>
              <span className="text-sm">Free</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Beyond the free radius:</span>
                <span className="font-semibold text-amber-400">
                  {calculation.chargeableKm} KM
                </span>
              </div>
              {!isSlab && (
                <div className="flex justify-between items-center text-slate-300 text-[11px]">
                  <span>Rate beyond the free radius:</span>
                  <span>{formatINR(distanceConfig.perKmRateBeyondFree)} / KM</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center gap-3 text-amber-300 font-bold">
                <span>Pickup &amp; delivery charge:</span>
                <span className="text-sm text-right">
                  {isSlab
                    ? formatINR(calculation.charge)
                    : `${calculation.chargeableKm} KM × ${formatINR(distanceConfig.perKmRateBeyondFree)} = ${formatINR(calculation.charge)}`}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
