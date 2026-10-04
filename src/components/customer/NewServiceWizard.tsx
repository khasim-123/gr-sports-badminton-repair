import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ServiceType,
  BatBrand,
  BatType,
  GettingType,
  RepairIssue,
  Address,
} from '../../types';
import { gettingTypesData, repairCategoriesData } from '../../data/mockData';
import {
  Wrench,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Info,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Button } from '../common/Button';
import { MapSimulation } from '../common/MapSimulation';

export const NewServiceWizard: React.FC = () => {
  const {
    addRequest,
    savedAddresses,
    distanceConfig,
    calculateDistanceCharge,
    gettingServices,
    repairCategories,
    setActiveView,
    setCustomerSubView,
    setSelectedRequestId,
    userName,
    userEmail,
    userMobile,
    wizardServiceType,
  } = useApp();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);

  // Form State
  const [serviceType, setServiceType] = useState<ServiceType>(wizardServiceType || 'GETTING');

  React.useEffect(() => {
    if (wizardServiceType) {
      setServiceType(wizardServiceType);
    }
  }, [wizardServiceType]);

  // Bat Details
  const [batBrand, setBatBrand] = useState<BatBrand>('Yonex');
  const [batModel, setBatModel] = useState<string>('Astrox 88D Pro');
  const [batType, setBatType] = useState<BatType>('Head Heavy (Power / Smash)');
  const [gettingType, setGettingType] = useState<GettingType>('Standard Getting');
  const [stringTension, setStringTension] = useState<number>(26);
  const [stringType, setStringType] = useState<string>('Yonex BG65 (White)');
  const [repairIssue, setRepairIssue] = useState<RepairIssue>('Frame Damage');
  const [repairDescription, setRepairDescription] = useState<string>(
    'Crack near 12 o’clock frame grommet after doubles partner clash.'
  );
  const [batPhotos, setBatPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=600&q=80',
  ]);
  const [additionalNotes, setAdditionalNotes] = useState<string>('Please handle carefully, favorite tournament racquet.');

  // Location & Distance
  const defaultFallbackAddress: Address = {
    id: 'ADDR-DEFAULT',
    label: 'Home',
    houseFlat: 'No. 42, Shuttle Residency',
    street: '100ft Road',
    area: 'Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560038',
    distanceKm: 4.5,
  };

  const initialAddress = savedAddresses.length > 0 ? savedAddresses[0] : defaultFallbackAddress;
  const [selectedAddress, setSelectedAddress] = useState<Address>(initialAddress);
  const [customDistanceKm, setCustomDistanceKm] = useState<number>(initialAddress.distanceKm || 4.5);

  const selectedGettingConfig =
    gettingServices.find((g) => g.name === gettingType) || gettingServices[0] || { price: 350, turnaround: '24-48 Hours' };
  const selectedRepairConfig =
    repairCategories.find((r) => r.name.toLowerCase().includes(repairIssue.toLowerCase())) || repairCategories[0];

  const distanceCalc = calculateDistanceCharge(customDistanceKm);

  // Step 4 calculations
  const servicePrice = serviceType === 'GETTING' ? (selectedGettingConfig?.price ?? 350) : 0; // Repair is inspection based!
  const finalTotal = servicePrice + distanceCalc.charge;

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = () => {
    const newId = addRequest({
      serviceType,
      customerName: userName,
      customerEmail: userEmail,
      customerMobile: userMobile,
      batBrand,
      batModel,
      batType,
      batPhotos,
      gettingType: serviceType === 'GETTING' ? gettingType : undefined,
      stringType: serviceType === 'GETTING' ? stringType : undefined,
      stringTensionLbs: serviceType === 'GETTING' ? stringTension : undefined,
      gettingPrice: serviceType === 'GETTING' ? selectedGettingConfig.price : 0,
      repairIssue: serviceType === 'REPAIR' ? repairIssue : undefined,
      repairDescription: serviceType === 'REPAIR' ? repairDescription : undefined,
      pickupAddress: selectedAddress,
      distanceKm: customDistanceKm,
      additionalNotes,
    });

    setSubmittedRequestId(newId);
    setCurrentStep(5);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Wizard Progress Stepper (Figma Item 21) */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {['Service', 'Bat Details', 'Location', 'Review', 'Confirmation'].map((name, idx) => {
            const stepNum = idx + 1;
            const isCompleted = currentStep > stepNum;
            const isCurrent = currentStep === stepNum;
            return (
              <div key={idx} className="flex flex-col items-center flex-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    isCompleted
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isCurrent
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-md'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : stepNum}
                </div>
                <span
                  className={`text-[11px] font-semibold mt-1.5 hidden sm:block ${
                    isCurrent ? 'text-blue-900 font-bold' : 'text-slate-500'
                  }`}
                >
                  {name}
                </span>
              </div>
            );
          })}
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300"
            style={{ width: `${((currentStep - 1) / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* STEP 1: SERVICE SELECTION */}
      {currentStep === 1 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="text-center max-w-lg mx-auto">
            <h2 className="text-2xl font-black text-slate-900">Select Badminton Service</h2>
            <p className="text-sm text-slate-600 mt-1">
              Choose the dedicated service for your badminton / shuttle bat.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            {/* Bat Getting Card */}
            <div
              onClick={() => setServiceType('GETTING')}
              className={`p-6 rounded-3xl border-2 cursor-pointer transition-all group ${
                serviceType === 'GETTING'
                  ? 'border-blue-600 bg-blue-50/40 shadow-lg ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
              }`}
            >
              <div className="relative h-40 w-full rounded-2xl overflow-hidden mb-4 border border-slate-200 shadow-2xs">
                <img
                  src="/images/stringing-machine.jpg"
                  alt="Electronic Stringing Machine"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                <span className="absolute bottom-2.5 left-2.5 text-white text-[11px] font-extrabold bg-blue-600/95 px-2.5 py-0.5 rounded-lg backdrop-blur-xs">
                  Electronic Load-Cell Tension
                </span>
                {serviceType === 'GETTING' && (
                  <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-xs font-bold shadow-md">
                    Selected ✓
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold text-slate-900">1. Bat Getting (Stringing)</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Professional electronic constant-pull stringing, custom tensioning (20–32 lbs), tournament multifilament string selection, and free grommet inspection.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Pricing: From ₹250</span>
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                  Turnaround: 24–48 Hours
                </span>
              </div>
            </div>

            {/* Bat Repair Card */}
            <div
              onClick={() => setServiceType('REPAIR')}
              className={`p-6 rounded-3xl border-2 cursor-pointer transition-all group ${
                serviceType === 'REPAIR'
                  ? 'border-blue-600 bg-blue-50/40 shadow-lg ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
              }`}
            >
              <div className="relative h-40 w-full rounded-2xl overflow-hidden mb-4 border border-slate-200 shadow-2xs">
                <img
                  src="/images/racket-repair.jpg"
                  alt="Carbon Composite Repair"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                <span className="absolute bottom-2.5 left-2.5 text-white text-[11px] font-extrabold bg-amber-600/95 px-2.5 py-0.5 rounded-lg backdrop-blur-xs">
                  Aerospace Carbon Splice
                </span>
                {serviceType === 'REPAIR' && (
                  <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-xs font-bold shadow-md">
                    Selected ✓
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold text-slate-900">2. Bat Repair (Carbon Composite)</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                High-tensile carbon fiber splice fusion, hairline frame crack bonding, broken shaft restoration, and handle rebuild.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col gap-1 text-xs">
                <div className="flex justify-between items-center text-amber-800 font-bold bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                  <span>Inspection Required</span>
                  <span>Target: Within 7 Days</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Estimate created after physical workshop assessment.
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleNext}
              size="lg"
              variant="primary"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Bat Details
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: BAT DETAILS */}
      {currentStep === 2 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="text-center max-w-lg mx-auto">
            <h2 className="text-2xl font-black text-slate-900">
              Enter {serviceType === 'GETTING' ? 'Getting' : 'Repair'} Specifications
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Provide your badminton bat brand, model, and service preferences.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-xs">
            {/* Brand & Model */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Bat Brand *
                </label>
                <select
                  value={batBrand}
                  onChange={(e) => setBatBrand(e.target.value as BatBrand)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                >
                  <option value="Yonex">Yonex</option>
                  <option value="Li-Ning">Li-Ning</option>
                  <option value="Victor">Victor</option>
                  <option value="Apacs">Apacs</option>
                  <option value="Carlton">Carlton</option>
                  <option value="Other">Other Brand</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Bat Model *
                </label>
                <input
                  type="text"
                  value={batModel}
                  onChange={(e) => setBatModel(e.target.value)}
                  placeholder="e.g. Astrox 99 Pro / Nanoflare 800"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                />
              </div>
            </div>

            {/* Bat Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Bat Type / Balance
              </label>
              <select
                value={batType}
                onChange={(e) => setBatType(e.target.value as BatType)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              >
                <option value="Even Balance (All-Round)">Even Balance (All-Round / Controlled Play)</option>
                <option value="Head Heavy (Power / Smash)">Head Heavy (Maximum Smash & Power)</option>
                <option value="Head Light (Speed / Defense)">Head Light (Rapid Defense & Netplay)</option>
                <option value="Training Racket (120g+)">Training Racket (120g+ Weighted Racket)</option>
                <option value="Junior Racket">Junior Racket</option>
              </select>
            </div>

            {/* GETTING SPECIFIC OPTIONS */}
            {serviceType === 'GETTING' && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Select Getting Tier *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {gettingServices.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setGettingType(item.name as GettingType)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        gettingType === item.name
                          ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                          : 'border-slate-200 bg-slate-50/50 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-sm text-slate-900">{item.name}</span>
                        <span className="text-sm font-extrabold text-blue-700">₹{item.price}</span>
                      </div>
                      <p className="text-xs text-slate-500">{item.description}</p>
                      <div className="mt-2 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Turnaround: {item.turnaround}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Desired String Tension (lbs)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="20"
                        max="32"
                        value={stringTension}
                        onChange={(e) => setStringTension(parseInt(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 font-black rounded-lg text-sm shrink-0">
                        {stringTension} lbs
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      String Preference
                    </label>
                    <select
                      value={stringType}
                      onChange={(e) => setStringType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                    >
                      <option value="Yonex BG65 (White) - All Round Durability">Yonex BG65 (White) - All Round Durability</option>
                      <option value="Yonex BG80 Power (Neon Orange) - Maximum Smash Repulsion">Yonex BG80 Power (Neon Orange) - Maximum Smash Repulsion</option>
                      <option value="Yonex Aerobite (Red/White) - Hybrid Spin & Control">Yonex Aerobite (Red/White) - Hybrid Spin & Control</option>
                      <option value="Yonex Exbolt 65 (Yellow) - Quick Repulsion & Crisp Sound">Yonex Exbolt 65 (Yellow) - Quick Repulsion & Crisp Sound</option>
                      <option value="Li-Ning No.1 - High Tension Durability">Li-Ning No.1 - High Tension Durability</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* REPAIR SPECIFIC OPTIONS */}
            {serviceType === 'REPAIR' && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                {/* Important Notice */}
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Inspection-Based Pricing:</span> Repair charges are <b>not fixed at booking time</b>. Our technician will conduct a physical carbon-load inspection upon doorstep pickup and prepare an exact estimate. You can approve or decline before repair starts!
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Primary Repair Issue *
                  </label>
                  <select
                    value={repairIssue}
                    onChange={(e) => setRepairIssue(e.target.value as RepairIssue)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  >
                    <option value="Broken Bat">Broken Bat (Full frame or shaft fracture)</option>
                    <option value="Frame Damage">Frame Damage (Hairline crack / deformation)</option>
                    <option value="Shaft Damage">Shaft Damage (Carbon splintering / loss of flex)</option>
                    <option value="Handle Damage">Handle Damage (Loose wooden core / staple pop)</option>
                    <option value="Joint Damage">Joint Damage (T-Joint stress crack)</option>
                    <option value="Grip Issue">Grip Issue (Polyurethane degradation / damp core)</option>
                    <option value="Other">Other / Custom Structural Issue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Damage Description & How it Happened
                  </label>
                  <textarea
                    rows={3}
                    value={repairDescription}
                    onChange={(e) => setRepairDescription(e.target.value)}
                    placeholder="Describe where the crack or issue is located..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>
              </div>
            )}

            {/* Photos upload preview */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Bat Condition Photos (Helps Pre-Assessment)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {batPhotos.map((photo, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-300">
                    <img src={photo} alt="Bat preview" className="w-full h-full object-cover" />
                  </div>
                ))}
                <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-blue-600 transition-colors bg-slate-50">
                  <Upload className="w-5 h-5 mb-1" />
                  <span className="text-[10px] font-semibold">Upload</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        // Add mock image
                        setBatPhotos((prev) => [
                          ...prev,
                          'https://images.unsplash.com/photo-1521537634581-0dced2fee2ef?auto=format&fit=crop&w=600&q=80',
                        ]);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Additional notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Additional Delivery / Handling Notes
              </label>
              <input
                type="text"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="e.g. Ring doorbell, call before arriving..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              />
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button onClick={handleBack} variant="outline" size="lg" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
            <Button onClick={handleNext} variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Continue to Pickup Location
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: LOCATION & DISTANCE CALCULATION */}
      {currentStep === 3 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="text-center max-w-lg mx-auto">
            <h2 className="text-2xl font-black text-slate-900">Doorstep Pickup Location</h2>
            <p className="text-sm text-slate-600 mt-1">
              Select your location to calculate distance and verify {distanceConfig.freeRadiusKm} KM Free Pickup eligibility.
            </p>
          </div>

          {/* Saved Addresses list */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Saved Addresses
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {savedAddresses.map((addr) => {
                const isSelected = selectedAddress?.id === addr.id;
                return (
                  <div
                    key={addr.id}
                    onClick={() => {
                      setSelectedAddress(addr);
                      setCustomDistanceKm(addr.distanceKm);
                    }}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-900 bg-blue-100 px-2 py-0.5 rounded-md">
                        {addr.label}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{addr.distanceKm} KM</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 mt-2">{addr.houseFlat}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {addr.street}, {addr.area}, {addr.pincode}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Map & Distance Calculation (Figma Item 25) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Distance Verification & Hub Routing
            </label>
            <MapSimulation
              distanceKm={customDistanceKm}
              onDistanceChange={(d) => setCustomDistanceKm(d)}
              addressLabel={`${selectedAddress.houseFlat}, ${selectedAddress.area}`}
            />
          </div>

          <div className="flex justify-between pt-4">
            <Button onClick={handleBack} variant="outline" size="lg" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
            <Button onClick={handleNext} variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Continue to Review
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: REQUEST REVIEW */}
      {currentStep === 4 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="text-center max-w-lg mx-auto">
            <h2 className="text-2xl font-black text-slate-900">Review Your Service Request</h2>
            <p className="text-sm text-slate-600 mt-1">
              Verify your racket specifications and pickup details before booking.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-xs">
            {/* Service & Bat Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                  Service Selection
                </span>
                <h4 className="text-base font-bold text-slate-900">
                  {serviceType === 'GETTING' ? `Bat Getting: ${gettingType}` : `Bat Repair: ${repairIssue}`}
                </h4>
                {serviceType === 'GETTING' ? (
                  <div className="text-xs text-slate-600 space-y-1">
                    <p>String: <b>{stringType}</b></p>
                    <p>Tension: <b>{stringTension} lbs</b></p>
                    <p>Turnaround: <b>{selectedGettingConfig.turnaround}</b></p>
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 space-y-1">
                    <p>Issue: <b>{repairIssue}</b></p>
                    <p>SLA Target: <b>Within 7 Days</b></p>
                    <p className="text-amber-800 font-semibold">
                      Cost: To be confirmed after physical workshop inspection
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                  Bat Specifications
                </span>
                <h4 className="text-base font-bold text-slate-900">
                  {batBrand} {batModel}
                </h4>
                <div className="text-xs text-slate-600 space-y-1">
                  <p>Type: <b>{batType}</b></p>
                  <p>Customer: <b>{userName} ({userMobile})</b></p>
                  <p>Notes: <i>"{additionalNotes}"</i></p>
                </div>
              </div>
            </div>

            {/* Location & Distance Summary */}
            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-1 text-xs">
              <div className="flex justify-between items-center font-bold text-slate-800 mb-1">
                <span>Pickup Location:</span>
                <span className="text-blue-800">{customDistanceKm} KM from Workshop</span>
              </div>
              <p className="text-slate-700">
                {selectedAddress.houseFlat}, {selectedAddress.street}, {selectedAddress.area}, {selectedAddress.city} - {selectedAddress.pincode}
              </p>
              <p className="text-slate-500 text-[11px] mt-1">Landmark: {selectedAddress.landmark}</p>
            </div>

            {/* Charges Breakdown Table */}
            <div className="bg-slate-50 rounded-2xl p-4 divide-y divide-slate-200 text-xs space-y-2.5">
              <div className="flex justify-between items-center text-slate-700 pb-1">
                <span>Service Charge:</span>
                {serviceType === 'GETTING' ? (
                  <span className="font-semibold text-slate-900">₹{servicePrice}</span>
                ) : (
                  <span className="font-semibold text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded-md">
                    To be confirmed after inspection
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center text-slate-700 pt-2">
                <span>Doorstep Pickup & Delivery:</span>
                {distanceCalc.isFree ? (
                  <span className="font-semibold text-emerald-700">₹0 (FREE within {distanceConfig.freeRadiusKm} KM)</span>
                ) : (
                  <span className="font-semibold text-slate-900">
                    ₹{distanceCalc.charge} ({distanceCalc.chargeableKm} KM × ₹{distanceConfig.perKmRateBeyondFree})
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center pt-3 text-base font-extrabold text-blue-900">
                <span>Total Amount Due on Delivery:</span>
                {serviceType === 'GETTING' ? (
                  <span className="text-2xl text-blue-700">₹{finalTotal}</span>
                ) : (
                  <span className="text-sm font-bold text-amber-800">
                    ₹{distanceCalc.charge} (Delivery) + Repair Quote (Post-Inspection)
                  </span>
                )}
              </div>
            </div>

            {/* CRITICAL BUSINESS RULE NOTICE (Figma Item 4 & 26) */}
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-emerald-950 mb-0.5">
                  NO ADVANCE ONLINE PAYMENT REQUIRED
                </p>
                <p className="leading-relaxed">
                  Payment will be collected <b>in-person after delivery</b>. You can pay our delivery executive via <b>Cash, UPI (Google Pay / PhonePe / Paytm), or QR</b> at your doorstep once you inspect the finished bat!
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button onClick={handleBack} variant="outline" size="lg" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              variant="primary"
              size="lg"
              className="px-8 shadow-md"
              rightIcon={<CheckCircle2 className="w-5 h-5" />}
            >
              Submit Service Request
            </Button>
          </div>
        </div>
      )}

      {/* STEP 5: CONFIRMATION / SUCCESS */}
      {currentStep === 5 && submittedRequestId && (
        <div className="text-center py-8 max-w-lg mx-auto space-y-6 animate-in zoom-in-95">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg ring-8 ring-emerald-50">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider">
              Booking Confirmed
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
              Request Submitted Successfully!
            </h2>
            <p className="text-sm text-slate-600 mt-1.5">
              Your service request ID is <b className="font-mono text-blue-700 font-extrabold text-base">{submittedRequestId}</b>
            </p>
          </div>

          {serviceType === 'REPAIR' && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 text-left">
              <p className="font-bold mb-1">What Happens Next for Repair?</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-700">
                <li>Our executive will collect your bat from your doorstep.</li>
                <li>Workshop master technician conducts graphite stress inspection.</li>
                <li>You will receive an itemized <b>Repair Estimate notification</b>.</li>
                <li>Repair begins only after your digital 1-click approval!</li>
              </ul>
            </div>
          )}

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1 text-left">
            <div className="flex justify-between">
              <span>Customer:</span>
              <span className="font-semibold text-slate-900">{userName}</span>
            </div>
            <div className="flex justify-between">
              <span>Bat:</span>
              <span className="font-semibold text-slate-900">{batBrand} {batModel}</span>
            </div>
            <div className="flex justify-between">
              <span>Pickup Distance:</span>
              <span className="font-semibold text-slate-900">{customDistanceKm} KM ({distanceCalc.isFree ? 'Free' : `₹${distanceCalc.charge}`})</span>
            </div>
            <div className="flex justify-between">
              <span>Payment Mode:</span>
              <span className="font-semibold text-emerald-700">Collected on Doorstep Delivery</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={() => {
                setSelectedRequestId(submittedRequestId);
                setCustomerSubView('detail');
              }}
              className="flex-1"
              size="lg"
              variant="primary"
            >
              Track Request Status
            </Button>
            <Button
              onClick={() => {
                setCustomerSubView('dashboard');
              }}
              className="flex-1"
              size="lg"
              variant="outline"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
