import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CustomerDashboard } from './CustomerDashboard';
import { NewServiceWizard } from './NewServiceWizard';
import { MyRequests } from './MyRequests';
import { RequestDetailView } from './RequestDetailView';
import {
  MapPin,
  User,
  Phone,
  Mail,
  ShieldCheck,
  PlusCircle,
  Trash2,
  Check,
  X,
  Compass,
  Building,
  Save,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../common/Button';

export const CustomerPortal: React.FC = () => {
  const {
    customerSubView,
    setCustomerSubView,
    savedAddresses,
    distanceConfig,
    userName,
    userEmail,
    userMobile,
    addNewAddress,
    deleteAddress,
    setDefaultAddress,
    updateUserProfile,
  } = useApp();

  // Address Modal State
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addrLabel, setAddrLabel] = useState<'Home' | 'Office' | 'Other'>('Home');
  const [addrHouseFlat, setAddrHouseFlat] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrArea, setAddrArea] = useState('');
  const [addrCity, setAddrCity] = useState('Bengaluru');
  const [addrPincode, setAddrPincode] = useState('560038');
  const [addrLandmark, setAddrLandmark] = useState('');
  const [addrDistance, setAddrDistance] = useState<number>(10.5);

  // Profile Edit State
  const [editName, setEditName] = useState(userName || 'Vikram Malhotra');
  const [editMobile, setEditMobile] = useState(userMobile || '+91 99887 76655');
  const [profileSaved, setProfileSaved] = useState(false);

  const handleCreateAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrHouseFlat.trim() || !addrArea.trim()) return;

    addNewAddress({
      label: addrLabel,
      houseFlat: addrHouseFlat,
      street: addrStreet || 'Main Road',
      area: addrArea,
      city: addrCity,
      state: 'Karnataka',
      pincode: addrPincode,
      landmark: addrLandmark,
      distanceKm: addrDistance,
      isDefault: savedAddresses.length === 0,
    });

    setAddressModalOpen(false);
    setAddrHouseFlat('');
    setAddrStreet('');
    setAddrArea('');
    setAddrLandmark('');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile(editName, editMobile);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar for customer portal (Mobile swipe bar only; desktop uses unified top Navbar to eliminate duplicate header bar) */}
      <div className="md:hidden bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex overflow-x-auto gap-2 py-2.5 text-xs font-semibold">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'wizard', label: '+ Book New Service' },
            { id: 'requests', label: 'My Requests' },
            { id: 'addresses', label: 'Saved Addresses' },
            { id: 'profile', label: 'Player Profile' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCustomerSubView(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                customerSubView === tab.id
                  ? 'bg-blue-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Render Active Customer Subview */}
      <div>
        {customerSubView === 'dashboard' && <CustomerDashboard />}
        {customerSubView === 'wizard' && <NewServiceWizard />}
        {customerSubView === 'requests' && <MyRequests />}
        {customerSubView === 'detail' && <RequestDetailView />}

        {/* Addresses View */}
        {customerSubView === 'addresses' && (
          <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Doorstep Pickup Addresses</h2>
                <p className="text-xs text-slate-500">Manage residential and court locations for rapid pickup dispatch.</p>
              </div>
              <Button
                onClick={() => setAddressModalOpen(true)}
                variant="primary"
                size="sm"
                leftIcon={<PlusCircle className="w-4 h-4" />}
              >
                Add Address
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {savedAddresses.map((addr) => (
                <div key={addr.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3 relative group">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-md">
                      {addr.label}
                    </span>
                    <span className="text-xs font-bold text-slate-700">{addr.distanceKm} KM from Hub</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{addr.houseFlat}</p>
                  <p className="text-xs text-slate-600">
                    {addr.street}, {addr.area}, {addr.city} - {addr.pincode}
                  </p>
                  <p className="text-[11px] text-slate-400">Landmark: {addr.landmark || 'N/A'}</p>

                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                    <span className={addr.distanceKm <= distanceConfig.freeRadiusKm ? 'text-emerald-700 font-bold' : 'text-amber-700 font-semibold'}>
                      {addr.distanceKm <= distanceConfig.freeRadiusKm ? `✓ 100% Free Pickup & Delivery (Within ${distanceConfig.freeRadiusKm} KM)` : 'Distance Charges Apply'}
                    </span>

                    <div className="flex items-center gap-2">
                      {addr.isDefault ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded">
                          Default
                        </span>
                      ) : (
                        <button
                          onClick={() => setDefaultAddress(addr.id)}
                          className="text-[11px] text-blue-600 hover:underline"
                        >
                          Make Default
                        </button>
                      )}

                      {savedAddresses.length > 1 && (
                        <button
                          onClick={() => deleteAddress(addr.id)}
                          title="Delete Address"
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profile View */}
        {customerSubView === 'profile' && (
          <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Player Profile</h2>
              <p className="text-xs text-slate-500">Contact and authentication preferences.</p>
            </div>

            <form onSubmit={handleSaveProfile} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Authenticated Email (Primary Login)</label>
                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{userEmail || 'customer@grsports.com'}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Protected by passwordless Email OTP verification.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Contact Mobile Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={editMobile}
                    onChange={(e) => setEditMobile(e.target.value)}
                    required
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Used exclusively for delivery agent doorstep coordination.</p>
              </div>

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-950 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Account verified and active. {distanceConfig.freeRadiusKm} KM Free Pickup eligibility confirmed.</span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                {profileSaved && (
                  <span className="text-emerald-600 font-bold flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-4 h-4" /> Profile saved successfully!
                  </span>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="font-bold ml-auto"
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Save Profile Changes
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Real Interactive Add Address Modal */}
      {addressModalOpen && (
        <div
          onClick={() => setAddressModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[calc(100vh-2rem)] animate-in zoom-in-95"
          >
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 sm:p-6 relative shrink-0">
              <button
                onClick={() => setAddressModalOpen(false)}
                className="absolute top-4 right-4 text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-bold">Add Pickup Address</h3>
              <p className="text-xs text-blue-200 mt-0.5">Free doorstep pickup applies within {distanceConfig.freeRadiusKm} KM radius.</p>
            </div>

            <form onSubmit={handleCreateAddress} className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Address Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Home', 'Office', 'Other'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setAddrLabel(l)}
                      className={`py-2 rounded-xl font-bold border transition-all ${
                        addrLabel === l
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Flat / House / Court Name *</label>
                <input
                  type="text"
                  required
                  value={addrHouseFlat}
                  onChange={(e) => setAddrHouseFlat(e.target.value)}
                  placeholder="e.g. Flat 302, Green Glen Apartments"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Area / Locality *</label>
                  <input
                    type="text"
                    required
                    value={addrArea}
                    onChange={(e) => setAddrArea(e.target.value)}
                    placeholder="e.g. Indiranagar / Bellandur"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Pincode *</label>
                  <input
                    type="text"
                    required
                    value={addrPincode}
                    onChange={(e) => setAddrPincode(e.target.value)}
                    placeholder="e.g. 560038"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Landmark (Optional)</label>
                <input
                  type="text"
                  value={addrLandmark}
                  onChange={(e) => setAddrLandmark(e.target.value)}
                  placeholder="e.g. Near Indiranagar Metro Station"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Distance from Indiranagar Hub</span>
                  <span className="font-bold font-mono text-blue-700">{addrDistance} KM</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={35}
                  step={0.5}
                  value={addrDistance}
                  onChange={(e) => setAddrDistance(parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between items-center text-[11px]">
                  <span className={addrDistance <= distanceConfig.freeRadiusKm ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                    {addrDistance <= distanceConfig.freeRadiusKm
                      ? `🟢 100% Free Pickup (Within ${distanceConfig.freeRadiusKm} KM)`
                      : `🟡 Surcharge (${+(addrDistance - distanceConfig.freeRadiusKm).toFixed(1)} KM beyond ${distanceConfig.freeRadiusKm} KM)`}
                  </span>
                  <span className="text-slate-400">Hub: Indiranagar, BLR</span>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <Button
                  type="button"
                  onClick={() => setAddressModalOpen(false)}
                  variant="outline"
                  size="md"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="flex-1 font-bold"
                >
                  Save Address
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

