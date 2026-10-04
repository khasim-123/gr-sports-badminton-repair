import React from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/Badge';
import { Timeline } from '../common/Timeline';
import { Button } from '../common/Button';
import {
  ArrowLeft,
  Wrench,
  Truck,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Mail,
  User,
  ShieldAlert,
} from 'lucide-react';

export const RequestDetailView: React.FC = () => {
  const {
    selectedRequestId,
    requests,
    setCustomerSubView,
    setRepairEstimateModalOpen,
    setRevisedEstimateModalOpen,
    setModalTargetRequestId,
    distanceConfig,
  } = useApp();

  const request = requests.find((r) => r.id === selectedRequestId);

  if (!request) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600 mb-4">Request not found.</p>
        <Button onClick={() => setCustomerSubView('requests')} variant="outline">
          Back to Requests
        </Button>
      </div>
    );
  }

  const isRepair = request.serviceType === 'REPAIR';
  const isAwaitingApproval = request.status === 'Awaiting Customer Approval';
  const isRevised = request.repairEstimate?.isRevised;

  const handleOpenApprovalModal = () => {
    setModalTargetRequestId(request.id);
    if (isRevised) {
      setRevisedEstimateModalOpen(true);
    } else {
      setRepairEstimateModalOpen(true);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <button
          onClick={() => setCustomerSubView('requests')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Requests
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Request Reference:</span>
          <span className="font-mono text-sm font-extrabold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
            {request.id}
          </span>
        </div>
      </div>

      {/* ACTION BANNER: ESTIMATE READY / REVISED ESTIMATE */}
      {isAwaitingApproval && (
        <div className={`p-5 rounded-3xl border-2 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg animate-in slide-in-from-top-2 ${
          isRevised
            ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300'
            : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-2xl text-white shrink-0 ${isRevised ? 'bg-amber-600' : 'bg-blue-600'}`}>
              {isRevised ? <ShieldAlert className="w-6 h-6" /> : <Wrench className="w-6 h-6" />}
            </div>
            <div>
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isRevised ? 'bg-amber-200 text-amber-900' : 'bg-blue-200 text-blue-900'
              }`}>
                ACTION REQUIRED
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                {isRevised
                  ? 'Repair estimate has been updated. Your approval is required before we continue.'
                  : 'Your repair estimate is ready for approval.'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {isRevised
                  ? `Revised Amount: ₹${request.repairEstimate?.totalEstimate} (Reason: ${request.repairEstimate?.revisionReason})`
                  : `Technician estimated total repair cost: ₹${request.repairEstimate?.totalEstimate || 400}.`}
              </p>
            </div>
          </div>

          <Button
            onClick={handleOpenApprovalModal}
            size="lg"
            variant={isRevised ? 'secondary' : 'primary'}
            className="w-full sm:w-auto shrink-0 shadow-md font-bold"
          >
            {isRevised ? `Review Updated Estimate (₹${request.repairEstimate?.totalEstimate})` : 'Review & Approve Estimate'}
          </Button>
        </div>
      )}

      {/* Main Grid: Details on Left, Timeline on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Request Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
            {/* Visual Service Banner (Tailored to Service Type) */}
            <div className="relative h-44 sm:h-52 w-full rounded-2xl overflow-hidden border border-slate-200">
              <img
                src={request.serviceType === 'GETTING' ? '/images/stringing-machine.jpg' : '/images/racket-repair.jpg'}
                alt={request.serviceType === 'GETTING' ? 'Stringing Machine' : 'Carbon Repair Fixture'}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />
              
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-bold px-3 py-1 rounded-xl border border-white/20">
                {request.serviceType === 'GETTING' ? '⚡ ELECTRONIC STRINGING CALIBRATION' : '🛡️ CARBON SPLICE & RESIN BONDING'}
              </div>

              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                <div>
                  <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                    {request.batBrand} {request.batModel}
                  </p>
                  <p className="text-sm font-extrabold text-white">
                    {request.serviceType === 'GETTING'
                      ? `${request.gettingType} • Target: ${request.stringTensionLbs || 26} LBS`
                      : `Structural Repair: ${request.repairIssue}`}
                  </p>
                </div>
                <span className="text-[10px] font-bold bg-white/20 backdrop-blur-xs px-2.5 py-1 rounded-xl">
                  {request.serviceType === 'GETTING' ? '24–48h SLA' : '7-Day SLA'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Service Category
                </span>
                <h2 className="text-xl font-bold text-slate-900">
                  {request.serviceType === 'GETTING' ? 'Badminton Bat Getting' : 'Badminton Bat Structural Repair'}
                </h2>
              </div>
              <StatusBadge status={request.status} size="lg" />
            </div>

            {/* Bat Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bat Brand & Model</p>
                <p className="text-base font-bold text-slate-900">{request.batBrand} {request.batModel}</p>
                <p className="text-xs text-slate-600 mt-0.5">{request.batType}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {request.serviceType === 'GETTING' ? 'Getting Setup' : 'Reported Damage'}
                </p>
                {request.serviceType === 'GETTING' ? (
                  <>
                    <p className="text-sm font-bold text-slate-900">{request.gettingType}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      String: {request.stringType} ({request.stringTensionLbs} lbs)
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-slate-900">{request.repairIssue}</p>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                      {request.repairDescription}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Bat Photos */}
            {request.batPhotos && request.batPhotos.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Bat Condition Photos
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {request.batPhotos.map((photo, i) => (
                    <img
                      key={i}
                      src={photo}
                      alt="Bat condition"
                      className="w-24 h-24 object-cover rounded-xl border border-slate-200 shrink-0"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pickup & Delivery Location */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-600" /> Doorstep Pickup & Delivery Address
                </span>
                <span className="text-blue-700 font-semibold">{request.distanceKm} KM from Workshop</span>
              </div>
              <p className="text-slate-700">
                {request.pickupAddress.houseFlat}, {request.pickupAddress.street}, {request.pickupAddress.area}, {request.pickupAddress.city} - {request.pickupAddress.pincode}
              </p>
              <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                <span>Landmark: {request.pickupAddress.landmark || 'N/A'}</span>
                <span>•</span>
                <span className={request.isFreeDelivery ? 'text-emerald-700 font-bold' : 'text-slate-600'}>
                  {request.isFreeDelivery ? `100% Free Pickup & Delivery (Within ${distanceConfig.freeRadiusKm} KM)` : `Delivery Surcharge: ₹${request.pickupDeliveryCharge}`}
                </span>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-50 rounded-2xl p-4 divide-y divide-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-700 pb-1">
                <span>Service Charge:</span>
                <span className="font-semibold text-slate-900">
                  {request.serviceCharge > 0 ? `₹${request.serviceCharge}` : 'To be confirmed after inspection'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-700 pt-2">
                <span>Doorstep Pickup & Delivery:</span>
                <span className={`font-semibold ${request.isFreeDelivery ? 'text-emerald-700' : 'text-slate-900'}`}>
                  {request.isFreeDelivery ? `₹0 (FREE within ${distanceConfig.freeRadiusKm} KM)` : `₹${request.pickupDeliveryCharge}`}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 text-sm font-bold text-slate-900">
                <span>Total Payable on Delivery:</span>
                <span className="text-lg text-blue-800 font-extrabold">₹{request.totalAmount}</span>
              </div>
            </div>

            {/* Payment Notice */}
            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                <b>Payment Status: {request.paymentStatus}</b>. Payment is collected in-person after service completion and doorstep delivery (Cash or UPI).
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Status & Chronological Timeline */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>Service Lifecycle</span>
              <span className="text-xs text-slate-500 font-normal">Live Tracking</span>
            </h3>

            <Timeline request={request} />
          </div>

          {/* Assigned Technician Card if assigned */}
          {request.assignedEmployeeName && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Assigned Workshop Specialist
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{request.assignedEmployeeName}</h4>
                  <p className="text-xs text-slate-500">Certified Badminton Technician</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
