import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CustomerDashboard } from './CustomerDashboard';
import { NewServiceWizard } from './NewServiceWizard';
import { MyRequests } from './MyRequests';
import { RequestDetailView } from './RequestDetailView';
import { Checkout } from '../shop/Checkout';
import { MyOrders } from '../shop/MyOrders';
import { User, Phone, ShieldCheck, PlusCircle, Trash2, X, Save, CheckCircle2, AlertCircle, Smartphone, LogOut } from 'lucide-react';
import { Button } from '../common/Button';
import { formatMobile } from '../../utils/phone';
import { formatINR } from '../../utils/format';
import { authService } from '../../services/authService';
import { Address } from '../../types';
import { CustomerEmptyState } from './requestDisplay';
import { localityOf, phoneDisplay, telHref, useShopSettings } from '../../hooks/useShopSettings';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'wizard', label: '+ Book' },
  { id: 'requests', label: 'Requests' },
  { id: 'orders', label: 'Orders' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'profile', label: 'Profile' },
];

const inputClass =
  'w-full px-3.5 min-h-[44px] rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-ink/40 bg-white';

const formatAddress = (a: Address) =>
  [a.houseFlat, a.street, a.area, a.city].filter((p) => p && p.trim()).join(', ') + (a.pincode ? ` – ${a.pincode}` : '');

export const CustomerPortal: React.FC = () => {
  const {
    customerSubView,
    setCustomerSubView,
    selectedRequestId,
    savedAddresses,
    distanceConfig,
    calculateDistanceCharge,
    userName,
    userMobile,
    addNewAddress,
    deleteAddress,
    setDefaultAddress,
    updateUserProfile,
    logout,
  } = useApp();
  const shop = useShopSettings();

  // Each screen starts at the top (the navbar stays visible).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [customerSubView, selectedRequestId]);

  // ------------------------------------------------------------------ address dialog
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addrLabel, setAddrLabel] = useState<'Home' | 'Office' | 'Other'>('Home');
  const [addrHouseFlat, setAddrHouseFlat] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrArea, setAddrArea] = useState('');
  const [addrCity, setAddrCity] = useState('Visakhapatnam');
  const [addrPincode, setAddrPincode] = useState('');
  const [addrLandmark, setAddrLandmark] = useState('');
  const [addrDistance, setAddrDistance] = useState<number>(5);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const maxServiceKm = distanceConfig.maxServiceDistanceKm || 0;
  const sliderMax = Math.max(Math.ceil(maxServiceKm || 35), distanceConfig.freeRadiusKm + 5);

  useEffect(() => {
    if (!addressModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddressModalOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [addressModalOpen]);

  const openAddressModal = () => {
    setAddrError(null);
    setAddressModalOpen(true);
  };

  const handleCreateAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrHouseFlat.trim() || !addrArea.trim()) {
      setAddrError('Please enter the flat / house and the area.');
      return;
    }
    if (!/^\d{6}$/.test(addrPincode.trim())) {
      setAddrError('Please enter a valid 6-digit pincode.');
      return;
    }
    addNewAddress({
      label: addrLabel,
      houseFlat: addrHouseFlat.trim(),
      street: addrStreet.trim(),
      area: addrArea.trim(),
      city: addrCity.trim() || 'Visakhapatnam',
      state: 'Andhra Pradesh',
      pincode: addrPincode.trim(),
      landmark: addrLandmark.trim() || undefined,
      distanceKm: addrDistance,
      isDefault: savedAddresses.length === 0,
    });
    setAddressModalOpen(false);
    setAddrHouseFlat('');
    setAddrStreet('');
    setAddrArea('');
    setAddrLandmark('');
    setAddrPincode('');
    setAddrError(null);
  };

  // ------------------------------------------------------------------ profile
  const [editName, setEditName] = useState(userName || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    setEditName(userName || '');
  }, [userName]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = editName.trim();
    if (name.length < 2) {
      setProfileError('Please enter your name.');
      return;
    }
    setProfileError(null);
    setProfileSaving(true);
    try {
      // Saves the name on the server (the mobile number comes from the sign-in token).
      await authService.updateProfile({ name });
      authService.updateStoredSession({ activeView: 'customer_portal', customerSubView: 'profile' });
      updateUserProfile(name);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 4000);
    } catch (err) {
      setProfileError(err instanceof Error && err.message ? err.message : 'Your name could not be saved. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const activeTab = customerSubView === 'detail' ? 'requests' : customerSubView;
  const addrCalc = calculateDistanceCharge(addrDistance);

  return (
    <div>
      {/* Section tabs on phones / tablets (desktop uses the navbar). Sticks under the navbar. */}
      <nav className="lg:hidden sticky top-16 z-30 bg-white/95 backdrop-blur border-b border-line" aria-label="Your account">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 flex overflow-x-auto no-scrollbar gap-1 py-1.5 text-xs font-semibold">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCustomerSubView(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`flex-1 px-2.5 min-h-[40px] rounded-xl whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'bg-ink text-white font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {customerSubView === 'dashboard' && <CustomerDashboard />}
      {customerSubView === 'wizard' && <NewServiceWizard />}
      {customerSubView === 'requests' && <MyRequests />}
      {customerSubView === 'detail' && <RequestDetailView />}
      {customerSubView === 'checkout' && <Checkout />}
      {customerSubView === 'orders' && <MyOrders />}

      {/* Saved addresses */}
      {customerSubView === 'addresses' && (
        <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6 lg:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="font-display tracking-[0.01em] text-3xl font-bold text-slate-900">Pickup addresses</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Saved addresses make booking quicker. They are stored on this device only and are cleared when you log out.
              </p>
            </div>
            <Button onClick={openAddressModal} variant="primary" size="md" className="min-h-[44px] shrink-0" leftIcon={<PlusCircle className="w-4 h-4" />}>
              Add address
            </Button>
          </div>

          {savedAddresses.length === 0 ? (
            <CustomerEmptyState
              icon="addresses"
              title="No saved addresses"
              description="Add the address where we should collect your racket. You can also enter one while booking."
              actionText="Add address"
              onAction={openAddressModal}
            />
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {savedAddresses.map((addr) => {
                const calc = calculateDistanceCharge(addr.distanceKm);
                const outside = maxServiceKm > 0 && addr.distanceKm > maxServiceKm;
                return (
                  <li key={addr.id} className="bg-white p-4 sm:p-5 rounded-2xl border border-line shadow-2xs flex flex-col gap-2">
                    <div className="flex justify-between items-center gap-2">
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-ink bg-paper-deep px-2.5 py-0.5 rounded-md">
                          {addr.label}
                        </span>
                        {addr.isDefault && (
                          <span className="text-[11px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                            Default
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">~{addr.distanceKm} KM away</span>
                    </div>
                    <p className="text-sm text-slate-800">{formatAddress(addr)}</p>
                    {addr.landmark && <p className="text-xs text-slate-500">Landmark: {addr.landmark}</p>}
                    <p className={`text-xs font-semibold ${outside ? 'text-rose-700' : calc.isFree ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {outside
                        ? `Outside our ${maxServiceKm} KM pickup area`
                        : calc.isFree
                        ? 'Free pickup & delivery'
                        : `Pickup & delivery ${formatINR(calc.charge)}`}
                    </p>

                    <div className="pt-2 mt-auto border-t border-line/70 flex items-center justify-end gap-2 text-xs">
                      {confirmDeleteId === addr.id ? (
                        <>
                          <span className="mr-auto text-slate-600">Remove this address?</span>
                          <Button variant="outline" size="sm" className="min-h-[40px]" onClick={() => setConfirmDeleteId(null)}>
                            Keep
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            className="min-h-[40px]"
                            onClick={() => {
                              deleteAddress(addr.id);
                              setConfirmDeleteId(null);
                            }}
                          >
                            Remove
                          </Button>
                        </>
                      ) : (
                        <>
                          {!addr.isDefault && (
                            <Button variant="ghost" size="sm" className="min-h-[40px] text-ink" onClick={() => setDefaultAddress(addr.id)}>
                              Make default
                            </Button>
                          )}
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(addr.id)}
                            aria-label={`Remove ${addr.label} address`}
                            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Profile */}
      {customerSubView === 'profile' && (
        <div className="max-w-2xl mx-auto px-4 py-6 sm:p-6 lg:p-8 space-y-5">
          <div>
            <h1 className="font-display tracking-[0.01em] text-3xl font-bold text-slate-900">Profile</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Your name and the mobile number you sign in with.</p>
          </div>

          <form onSubmit={handleSaveProfile} className="bg-white p-4 sm:p-6 rounded-2xl border border-line shadow-2xs space-y-4 text-sm">
            <div>
              <label htmlFor="profile-name" className="block text-xs font-bold text-slate-700 mb-1">
                Full name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="profile-name"
                  type="text"
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setProfileError(null);
                  }}
                  maxLength={80}
                  autoComplete="name"
                  className={`${inputClass} pl-9 font-semibold`}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Used on your bookings and shown to our pickup agent.</p>
            </div>

            <div>
              <span className="block text-xs font-bold text-slate-700 mb-1">Mobile number (sign-in)</span>
              <div className="flex items-center gap-2 px-3.5 min-h-[44px] rounded-xl border border-line bg-paper font-semibold text-slate-800">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{formatMobile(userMobile) || '—'}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                You sign in with this number and our pickup agent calls it. To change it, call the shop on{' '}
                <a href={telHref(shop.phone)} className="font-semibold text-ink whitespace-nowrap">
                  {phoneDisplay(shop.phone)}
                </a>
                .
              </p>
            </div>

            <div className="p-3 bg-paper rounded-2xl border border-line text-xs text-slate-600 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>This number was verified with an SMS code when you signed in.</span>
            </div>

            {profileError && (
              <p className="text-xs text-rose-700 flex items-center gap-1.5" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0" /> {profileError}
              </p>
            )}

            <div className="pt-1 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
              {profileSaved ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1.5 text-xs" role="status">
                  <CheckCircle2 className="w-4 h-4" /> Name saved
                </span>
              ) : (
                <span />
              )}
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={profileSaving}
                disabled={profileSaving || editName.trim() === (userName || '').trim()}
                className="font-bold min-h-[44px]"
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save name
              </Button>
            </div>
          </form>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-line shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <Smartphone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                {savedAddresses.length > 0
                  ? `${savedAddresses.length} saved address${savedAddresses.length > 1 ? 'es are' : ' is'} stored on this device and will be removed when you log out.`
                  : 'Logging out removes your data from this device.'}
              </span>
            </div>
            <Button variant="outline" size="md" className="min-h-[44px] text-rose-700 border-rose-200 hover:bg-rose-50 shrink-0" leftIcon={<LogOut className="w-4 h-4" />} onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      )}

      {/* Add address dialog */}
      {addressModalOpen && (
        <div
          onClick={() => setAddressModalOpen(false)}
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-address-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-line my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] animate-in zoom-in-95"
          >
            <div className="bg-ink text-white px-5 py-4 flex items-start justify-between gap-3 shrink-0">
              <div>
                <h3 id="add-address-title" className="text-lg font-bold">
                  Add pickup address
                </h3>
                <p className="text-xs text-white/70 mt-0.5">Saved on this device. Free pickup within {distanceConfig.freeRadiusKm} KM.</p>
              </div>
              <button
                type="button"
                onClick={() => setAddressModalOpen(false)}
                aria-label="Close"
                className="w-10 h-10 -mr-2 -mt-1 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAddress} className="px-4 sm:px-5 pt-4 sm:pt-5 space-y-3.5 text-sm overflow-y-auto" noValidate>
              <div className="space-y-1">
                <span className="block text-xs font-bold text-slate-700">Address type</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['Home', 'Office', 'Other'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setAddrLabel(l)}
                      aria-pressed={addrLabel === l}
                      className={`min-h-[40px] rounded-xl text-xs font-bold border transition-all ${
                        addrLabel === l ? 'bg-ink text-white border-ink' : 'border-line text-slate-600 hover:bg-paper'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block space-y-1">
                <span className="block text-xs font-bold text-slate-700">Flat / house / building *</span>
                <input type="text" value={addrHouseFlat} onChange={(e) => setAddrHouseFlat(e.target.value)} placeholder="e.g. Flat 302, Sai Residency" className={inputClass} />
              </label>
              <label className="block space-y-1">
                <span className="block text-xs font-bold text-slate-700">Street / road</span>
                <input type="text" value={addrStreet} onChange={(e) => setAddrStreet(e.target.value)} placeholder="e.g. Beach Road" className={inputClass} />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="block text-xs font-bold text-slate-700">Area / locality *</span>
                  <input type="text" value={addrArea} onChange={(e) => setAddrArea(e.target.value)} placeholder="e.g. MVP Colony" className={inputClass} />
                </label>
                <label className="block space-y-1">
                  <span className="block text-xs font-bold text-slate-700">Pincode *</span>
                  <input
                    type="text"
                    value={addrPincode}
                    onChange={(e) => setAddrPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="e.g. 530017"
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="block text-xs font-bold text-slate-700">City</span>
                  <input type="text" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} className={inputClass} />
                </label>
                <label className="block space-y-1">
                  <span className="block text-xs font-bold text-slate-700">Landmark</span>
                  <input type="text" value={addrLandmark} onChange={(e) => setAddrLandmark(e.target.value)} placeholder="Optional" className={inputClass} />
                </label>
              </div>

              <div className="p-3.5 rounded-2xl bg-paper border border-line space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label htmlFor="addr-distance" className="font-bold text-slate-700">
                    Approx. distance from our {localityOf(shop)} shop
                  </label>
                  <span className="font-bold font-mono text-ink">{addrDistance} KM</span>
                </div>
                <input
                  id="addr-distance"
                  type="range"
                  min={1}
                  max={sliderMax}
                  step={0.5}
                  value={addrDistance}
                  onChange={(e) => setAddrDistance(parseFloat(e.target.value))}
                  className="w-full accent-ink h-8"
                />
                <p
                  className={`text-xs font-semibold ${
                    maxServiceKm > 0 && addrDistance > maxServiceKm ? 'text-rose-700' : addrCalc.isFree ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {maxServiceKm > 0 && addrDistance > maxServiceKm
                    ? `Outside our ${maxServiceKm} KM pickup area — please drop your racket at the shop.`
                    : addrCalc.isFree
                    ? `Free pickup & delivery (within ${distanceConfig.freeRadiusKm} KM)`
                    : `Pickup & delivery ${formatINR(addrCalc.charge)}`}
                </p>
              </div>

              {addrError && (
                <p className="text-xs text-rose-700 flex items-center gap-1.5" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {addrError}
                </p>
              )}

              <div className="sticky bottom-0 -mx-4 sm:-mx-5 px-4 sm:px-5 py-3 bg-white border-t border-line grid grid-cols-2 gap-3">
                <Button type="button" onClick={() => setAddressModalOpen(false)} variant="outline" size="md" className="min-h-[44px]">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" className="font-bold min-h-[44px]">
                  Save address
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
