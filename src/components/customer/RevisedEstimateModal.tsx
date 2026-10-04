import React from 'react';
import { useApp } from '../../context/AppContext';
import { X, AlertCircle, ArrowUpRight, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { Button } from '../common/Button';

export const RevisedEstimateModal: React.FC = () => {
  const {
    revisedEstimateModalOpen,
    setRevisedEstimateModalOpen,
    modalTargetRequestId,
    requests,
    approveRepairEstimate,
    declineRepairEstimate,
  } = useApp();

  if (!revisedEstimateModalOpen || !modalTargetRequestId) return null;

  const request = requests.find((r) => r.id === modalTargetRequestId);
  if (!request || !request.repairEstimate) return null;

  const est = request.repairEstimate;
  const original = est.originalEstimate || 400;
  const newTotal = est.totalEstimate || 650;
  const additional = newTotal - original;

  return (
    <div
      onClick={() => setRevisedEstimateModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border-2 border-amber-300 my-auto flex flex-col max-h-[calc(100vh-2rem)] animate-in zoom-in-95"
      >
        {/* Warning Alert Banner Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-700 text-white p-5 sm:p-6 relative shrink-0">
          <button
            onClick={() => setRevisedEstimateModalOpen(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold mb-2">
            <ShieldAlert className="w-3.5 h-3.5" /> REVISION APPROVAL GATE
          </div>
          <h3 className="text-xl font-extrabold text-white">Updated Repair Estimate</h3>
          <p className="text-xs text-amber-100 mt-1">
            Request #{request.id} • {request.batBrand} {request.batModel}
          </p>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Transparent Reason Box */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-700" /> Reason for Price Revision
            </h4>
            <p className="text-sm font-semibold text-slate-800 leading-relaxed">
              "{est.revisionReason || 'Additional frame and shaft damage identified during repair preparation.'}"
            </p>
            <p className="text-xs text-amber-800 mt-2">
              Our master technician halted work immediately upon uncovering the secondary fissure. We never proceed without player authorization.
            </p>
          </div>

          {/* Before vs After Comparison Card */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex justify-between items-center text-xs text-slate-600">
              <span>Original Approved Estimate:</span>
              <span className="font-semibold text-slate-800">₹{original}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-amber-700 font-semibold">
              <span className="flex items-center gap-1">
                <ArrowUpRight className="w-4 h-4" /> Additional Repair / Materials:
              </span>
              <span>+₹{additional}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-900">New Total Estimate:</span>
              <span className="text-2xl font-black text-amber-600">₹{newTotal}</span>
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <b>Zero Risk:</b> Payment of ₹{newTotal} is collected only <b>after</b> doorstep delivery and physical inspection by you.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              onClick={() => declineRepairEstimate(request.id)}
              variant="outline"
              size="lg"
              className="w-full text-slate-700 hover:bg-rose-50 border-rose-200 text-xs sm:text-sm"
              leftIcon={<XCircle className="w-4 h-4 text-rose-500" />}
            >
              Decline Repair
            </Button>
            <Button
              onClick={() => approveRepairEstimate(request.id)}
              variant="success"
              size="lg"
              className="w-full text-xs sm:text-sm font-bold shadow-md bg-emerald-600 hover:bg-emerald-700"
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Approve ₹{newTotal}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
