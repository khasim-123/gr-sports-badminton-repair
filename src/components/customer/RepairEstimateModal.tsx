import React from 'react';
import { useApp } from '../../context/AppContext';
import { X, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Wrench, FileText } from 'lucide-react';
import { Button } from '../common/Button';

export const RepairEstimateModal: React.FC = () => {
  const {
    repairEstimateModalOpen,
    setRepairEstimateModalOpen,
    modalTargetRequestId,
    requests,
    approveRepairEstimate,
    declineRepairEstimate,
    distanceConfig,
  } = useApp();

  if (!repairEstimateModalOpen || !modalTargetRequestId) return null;

  const request = requests.find((r) => r.id === modalTargetRequestId);
  if (!request || !request.repairEstimate) return null;

  const est = request.repairEstimate;

  return (
    <div
      onClick={() => setRepairEstimateModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[calc(100vh-2rem)] animate-in zoom-in-95"
      >
        {/* Header - Fixed at top */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 sm:p-6 relative shrink-0">
          <button
            onClick={() => setRepairEstimateModalOpen(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-500/30">
            <Wrench className="w-3.5 h-3.5" /> Physical Workshop Assessment Complete
          </div>
          <h3 className="text-xl font-bold text-white">Repair Estimate Ready</h3>
          <p className="text-xs text-blue-200 mt-1">
            Request #{request.id} • {request.batBrand} {request.batModel}
          </p>
        </div>

        {/* Content - Scrollable if needed */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Inspection Findings Box */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Inspection Findings & Scope
              </h4>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {est.inspectionNotes ||
                'Inspected upper frame joint and carbon lattice. Requires structural carbon sleeve splice and resin compression cure.'}
            </p>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-2">
              <span>Primary Issue: <b>{request.repairIssue}</b></span>
              <span>•</span>
              <span>Expected Turnaround: <b>{est.expectedCompletionDate || 'Within 7 Days'}</b></span>
            </div>
          </div>

          {/* Transparent Itemized Price Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 divide-y divide-slate-100 text-xs space-y-2.5">
            <div className="flex justify-between items-center text-slate-600 pb-1">
              <span>Technician Labour Charge:</span>
              <span className="font-semibold text-slate-900">₹{est.labourCharge}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 pt-2">
              <span>Materials / Carbon Fiber Splices:</span>
              <span className="font-semibold text-slate-900">₹{est.materialsCharge}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 pt-2">
              <span>Additional Workshop Charges:</span>
              <span className="font-semibold text-slate-900">₹{est.additionalCharges || 0}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 pt-2">
              <span>Doorstep Pickup & Delivery:</span>
              <span className="font-semibold text-emerald-600">
                {request.isFreeDelivery ? `₹0 (FREE within ${distanceConfig.freeRadiusKm} KM)` : `₹${request.pickupDeliveryCharge}`}
              </span>
            </div>
            {est.discount > 0 && (
              <div className="flex justify-between items-center text-emerald-600 pt-2">
                <span>Special Courtesy Discount:</span>
                <span className="font-semibold">-₹{est.discount}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-3 text-base font-extrabold text-blue-900">
              <span>Total Estimated Repair:</span>
              <span className="text-xl text-blue-700">₹{est.totalEstimate}</span>
            </div>
          </div>

          {/* Transparent Notice */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold">Customer Approval Required:</span> We never begin physical repairs or modify your racket without your explicit consent.
              <p className="mt-1 font-bold text-amber-900">
                Payment of ₹{est.totalEstimate} will only be collected in-person after doorstep delivery.
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              onClick={() => declineRepairEstimate(request.id)}
              variant="outline"
              size="lg"
              className="w-full text-slate-700 border-rose-300 hover:bg-rose-50 text-xs sm:text-sm"
              leftIcon={<XCircle className="w-4 h-4 text-rose-500" />}
            >
              Decline Repair
            </Button>
            <Button
              onClick={() => approveRepairEstimate(request.id)}
              variant="success"
              size="lg"
              className="w-full text-xs sm:text-sm font-bold shadow-md"
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Approve Repair (₹{est.totalEstimate})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
