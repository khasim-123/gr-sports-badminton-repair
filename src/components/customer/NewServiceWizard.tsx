import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ServiceType,
  BatType,
  GettingType,
  RepairIssue,
  Address,
} from '../../types';
import { contentService } from '../../services/contentService';
import { ApiError } from '../../services/apiClient';
import { PublicAvailability, StringProduct, StringVariant } from '../../types/content';
import {
  CheckCircle2,
  Check,
  ArrowRight,
  ArrowLeft,
  Upload,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Clock,
  Locate,
  Package,
  X,
  Loader2,
  Search,
  Grid3x3,
  Wrench,
} from 'lucide-react';
import { Button } from '../common/Button';
import { formatMobile } from '../../utils/phone';
import { formatINR } from '../../utils/format';
import { repairCategoryFor } from './requestDisplay';
import { MapSimulation } from '../common/MapSimulation';
import { getCurrentLocation, hasCoords, LocationError, roadDistanceKm } from '../../utils/distance';
import { phoneDisplay, telHref, useShopSettings } from '../../hooks/useShopSettings';

const OWN_STRING = '__own__';
const WIZARD_STEPS = ['Service', 'Your racket', 'Pickup', 'Review', 'Done'];
const MAX_PHOTOS = 3;

type LoadStatus = 'loading' | 'ready' | 'error';

/** "Yonex" + "BG65" → "Yonex BG65" (avoids "Yonex Yonex BG65"). */
const productLabel = (p: StringProduct) =>
  p.brand && !p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? `${p.brand} ${p.name}` : p.name;

const inStockVariants = (p: StringProduct) => (p.variants || []).filter((v) => v.inStock);

/** A product can be chosen when it has no colour variants or at least one in stock. */
const isProductSelectable = (p: StringProduct) => (p.variants || []).length === 0 || inStockVariants(p).length > 0;

const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatDay = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', opts);
};

/** Downscale an image file to a compact JPEG data URL for the request's photo list. */
const fileToResizedDataUrl = (file: File, maxDim = 900, quality = 0.72): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the photo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('This file is not a supported image.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process the photo.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

const emptyAddressForm = {
  label: 'Home' as Address['label'],
  houseFlat: '',
  street: '',
  area: '',
  city: 'Visakhapatnam',
  pincode: '',
  landmark: '',
  lat: undefined as number | undefined,
  lng: undefined as number | undefined,
};

export const NewServiceWizard: React.FC = () => {
  const {
    addRequest,
    addNewAddress,
    savedAddresses,
    distanceConfig,
    calculateDistanceCharge,
    gettingServices,
    repairCategories,
    setCustomerSubView,
    setSelectedRequestId,
    userName,
    userMobile,
    wizardServiceType,
    wizardPrefill,
    setWizardPrefill,
  } = useApp();

  // Arriving from the homepage form (service already chosen, details filled in): start at "Your racket".
  const [currentStep, setCurrentStep] = useState<number>(() =>
    wizardPrefill && Object.keys(wizardPrefill).some((k) => k !== 'serviceType') ? 2 : 1,
  );
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitErrorIsDate, setSubmitErrorIsDate] = useState(false);

  // ---------------------------------------------------------------- service & bat
  const [serviceType, setServiceType] = useState<ServiceType>(wizardPrefill?.serviceType || wizardServiceType || 'GETTING');
  const [batBrand, setBatBrand] = useState<string>(wizardPrefill?.batBrand || '');
  const [batModel, setBatModel] = useState<string>(wizardPrefill?.batModel || '');
  const [batType, setBatType] = useState<BatType>('Head Heavy (Power / Smash)');
  const [gettingType, setGettingType] = useState<GettingType>('Basic Stringing');
  const [stringTension, setStringTension] = useState<number>(wizardPrefill?.stringTension || 26);
  const [repairIssue, setRepairIssue] = useState<RepairIssue>((wizardPrefill?.repairIssue as RepairIssue) || 'Frame Damage');
  const [repairDescription, setRepairDescription] = useState<string>(wizardPrefill?.repairDescription || '');
  const [batPhotos, setBatPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState<string>('');

  // ---------------------------------------------------------------- string catalogue
  const [catalogue, setCatalogue] = useState<StringProduct[]>([]);
  const [catalogueStatus, setCatalogueStatus] = useState<LoadStatus>('loading');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [stringBrandFilter, setStringBrandFilter] = useState<string>('All');
  const [stringSearch, setStringSearch] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [ownStringNote, setOwnStringNote] = useState<string>('');
  const [prefillStringNotice, setPrefillStringNotice] = useState<string | null>(null);
  // Degraded mode (catalogue unavailable): free text
  const [freeTextString, setFreeTextString] = useState<string>(wizardPrefill?.stringType || '');
  const [freeTextColour, setFreeTextColour] = useState<string>(wizardPrefill?.stringColour || '');

  // ---------------------------------------------------------------- pickup availability
  const [availability, setAvailability] = useState<PublicAvailability | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = useState<LoadStatus>('loading');
  const [pickupDate, setPickupDate] = useState<string>(wizardPrefill?.pickupDate || '');
  const [pickupSlot, setPickupSlot] = useState<string>('');
  const [prefillDateNotice, setPrefillDateNotice] = useState<string | null>(null);

  // ---------------------------------------------------------------- location
  const [fetchingLocation, setFetchingLocation] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const defaultAddress = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
  const [addressChoice, setAddressChoice] = useState<string>(defaultAddress ? defaultAddress.id : 'NEW');
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [saveNewAddress, setSaveNewAddress] = useState<boolean>(true);
  // Typed distance, used only when we don't have the customer's location.
  const [manualKmText, setManualKmText] = useState<string>(
    defaultAddress && !hasCoords(defaultAddress) && defaultAddress.distanceKm > 0 ? String(defaultAddress.distanceKm) : ''
  );
  const setCustomDistanceKm = (km: number | undefined) => setManualKmText(km != null && km > 0 ? String(km) : '');
  const shop = useShopSettings();

  // ---------------------------------------------------------------- effects
  useEffect(() => {
    if (wizardServiceType) setServiceType(wizardServiceType);
  }, [wizardServiceType]);

  // Apply a new prefill (e.g. booking started from the landing page).
  useEffect(() => {
    if (!wizardPrefill) return;
    if (wizardPrefill.serviceType) setServiceType(wizardPrefill.serviceType);
    if (wizardPrefill.batBrand) setBatBrand(wizardPrefill.batBrand);
    if (wizardPrefill.batModel) setBatModel(wizardPrefill.batModel);
    if (wizardPrefill.stringTension) setStringTension(wizardPrefill.stringTension);
    if (wizardPrefill.repairIssue) setRepairIssue(wizardPrefill.repairIssue as RepairIssue);
    if (wizardPrefill.repairDescription) setRepairDescription(wizardPrefill.repairDescription);
    if (wizardPrefill.pickupDate) setPickupDate(wizardPrefill.pickupDate);
    if (wizardPrefill.stringType) setFreeTextString(wizardPrefill.stringType);
    if (wizardPrefill.stringColour) setFreeTextColour(wizardPrefill.stringColour);
  }, [wizardPrefill]);

  // Real string catalogue.
  useEffect(() => {
    let cancelled = false;
    setCatalogueStatus('loading');
    contentService
      .getPublicStrings()
      .then((products) => {
        if (cancelled) return;
        const list = (Array.isArray(products) ? products : [])
          .filter((p) => p.isActive !== false)
          .map((p) => ({ ...p, variants: [...(p.variants || [])].sort((a, b) => a.sortOrder - b.sortOrder) }))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setCatalogue(list);
        // An empty catalogue isn't useful for picking — fall back to free text.
        setCatalogueStatus(list.length > 0 ? 'ready' : 'error');
      })
      .catch((err) => {
        console.warn('String catalogue unavailable', err);
        if (!cancelled) setCatalogueStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAvailability = () => {
    setAvailabilityStatus('loading');
    return contentService
      .getAvailability(60)
      .then((data) => {
        if (!data || !Array.isArray(data.days)) throw new Error('Invalid availability response');
        setAvailability(data);
        setAvailabilityStatus('ready');
        return data;
      })
      .catch((err) => {
        console.warn('Pickup availability unavailable', err);
        setAvailabilityStatus('error');
        return null;
      });
  };

  useEffect(() => {
    loadAvailability();
  }, []);

  // Match the prefilled string/colour against the catalogue once it is loaded.
  const appliedStringPrefill = useRef<unknown>(null);
  useEffect(() => {
    if (catalogueStatus !== 'ready' || !wizardPrefill?.stringType) return;
    if (appliedStringPrefill.current === wizardPrefill) return;
    appliedStringPrefill.current = wizardPrefill;

    const wanted = wizardPrefill.stringType.toLowerCase().replace(/\s*\(.*\)\s*$/, '').trim();
    const product =
      catalogue.find((p) => productLabel(p).toLowerCase() === wanted || p.name.toLowerCase() === wanted) ||
      catalogue.find(
        (p) =>
          wanted.includes(p.name.toLowerCase()) ||
          productLabel(p).toLowerCase().includes(wanted) ||
          (!!p.code && wanted.includes(p.code.toLowerCase()))
      );
    if (!product) {
      setPrefillStringNotice(`"${wizardPrefill.stringType}" isn't in our current string catalogue — please pick a string below.`);
      return;
    }
    if (!isProductSelectable(product)) {
      setPrefillStringNotice(`${productLabel(product)} is currently out of stock — please pick another string.`);
      return;
    }
    setSelectedProductId(product.id);
    const colour = (wizardPrefill.stringColour || '').toLowerCase();
    const variant = colour ? product.variants.find((v) => v.colour.toLowerCase() === colour) : undefined;
    if (variant && variant.inStock) {
      setSelectedVariantId(variant.id);
    } else {
      setSelectedVariantId(inStockVariants(product).length === 1 ? inStockVariants(product)[0].id : '');
      if (variant && !variant.inStock) {
        setPrefillStringNotice(`${variant.colour} is out of stock for ${productLabel(product)} — please pick another colour.`);
      }
    }
  }, [catalogueStatus, catalogue, wizardPrefill]);

  // Validate a prefilled / previously chosen pickup date against live availability.
  useEffect(() => {
    if (availabilityStatus !== 'ready' || !availability || !pickupDate) return;
    const day = availability.days.find((d) => d.date === pickupDate);
    if (!day || !day.available) {
      setPrefillDateNotice(
        `${formatDay(pickupDate)} is not available for pickup${day?.reason ? ` (${day.reason})` : ''}. Please choose another day.`
      );
      setPickupDate('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availabilityStatus, availability]);

  // Keep the selected getting tier valid for the live tier list.
  const activeTiers = gettingServices.filter((g) => g.isActive !== false);
  useEffect(() => {
    if (activeTiers.length > 0 && !activeTiers.some((g) => g.name === gettingType)) {
      setGettingType(activeTiers[0].name as GettingType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gettingServices]);

  // Map the repair issue onto a live repair category (prefills use short names like "Frame Damage").
  useEffect(() => {
    const cats = repairCategories.filter((c) => c.isActive !== false);
    if (cats.length === 0) return;
    if (cats.some((c) => c.name === repairIssue)) return;
    const match = repairCategoryFor(repairIssue, cats);
    setRepairIssue((match || cats[0]).name as RepairIssue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repairCategories, repairIssue]);

  // Default to the user's default saved address once addresses are available.
  useEffect(() => {
    if (addressChoice === 'NEW' && defaultAddress && !addressForm.houseFlat && !addressForm.lat) {
      setAddressChoice(defaultAddress.id);
      setCustomDistanceKm(defaultAddress.distanceKm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAddresses.length]);

  // ---------------------------------------------------------------- derived
  const tierPrices = activeTiers.filter((t) => t.price > 0).map((t) => t.price);
  const tierPriceRange =
    tierPrices.length === 0
      ? 'Price confirmed at pickup'
      : Math.min(...tierPrices) === Math.max(...tierPrices)
      ? formatINR(tierPrices[0])
      : `${formatINR(Math.min(...tierPrices))} – ${formatINR(Math.max(...tierPrices))}`;
  const tierTurnaround = activeTiers.length === 1 && activeTiers[0].turnaround ? `Ready in ${activeTiers[0].turnaround}` : '';
  const activeCategories = repairCategories.filter((c) => c.isActive !== false);
  const repairBasePrices = activeCategories.filter((c) => c.basePrice > 0).map((c) => c.basePrice);
  const repairBaseFrom = repairBasePrices.length > 0 ? `From ${formatINR(Math.min(...repairBasePrices))}` : 'Price after inspection';
  const selectedCategory = repairCategoryFor(repairIssue, activeCategories);
  const repairNeedsDescription = /^other/i.test(repairIssue) || selectedCategory?.id === 'other';
  const selectedGettingConfig = activeTiers.find((g) => g.name === gettingType) || activeTiers[0];
  const selectedProduct = catalogue.find((p) => p.id === selectedProductId);
  const catalogueBrands = Array.from(new Set(catalogue.map((p) => p.brand)));
  // Keep the chosen string visible even if it belongs to another brand than the filter.
  const visibleCatalogue =
    stringBrandFilter === 'All'
      ? catalogue
      : catalogue.filter((p) => p.brand === stringBrandFilter || p.id === selectedProductId);
  const stringQuery = stringSearch.trim().toLowerCase();
  const searchedCatalogue = stringQuery
    ? visibleCatalogue.filter(
        (p) =>
          [p.brand, p.name, p.code, p.gauge].filter(Boolean).join(' ').toLowerCase().includes(stringQuery) ||
          p.id === selectedProductId
      )
    : visibleCatalogue;
  const selectedVariant: StringVariant | undefined = selectedProduct?.variants.find((v) => v.id === selectedVariantId);
  const useCatalogue = catalogueStatus === 'ready';
  const ownString = selectedProductId === OWN_STRING;

  const stringSummary = useMemo(() => {
    if (!useCatalogue) {
      const name = freeTextString.trim() || "Any (Technician's Choice)";
      const colour = freeTextColour.trim();
      return { name, colour, label: colour ? `${name} (${colour})` : name, price: null as number | null };
    }
    if (ownString) {
      const name = `Customer-provided string${ownStringNote.trim() ? `: ${ownStringNote.trim()}` : ''}`;
      return { name, colour: '', label: name, price: null as number | null };
    }
    if (!selectedProduct) return { name: '', colour: '', label: '', price: null as number | null };
    const name = productLabel(selectedProduct);
    const colour = selectedVariant?.colour || '';
    return {
      name,
      colour,
      label: colour ? `${name} (${colour})` : name,
      price: selectedProduct.price ?? null,
    };
  }, [useCatalogue, freeTextString, freeTextColour, ownString, ownStringNote, selectedProduct, selectedVariant]);

  const selectedAddress: Address | undefined =
    addressChoice === 'NEW' ? undefined : savedAddresses.find((a) => a.id === addressChoice);

  // Distance: from the customer's location when we have it (the server recalculates it the same
  // way), otherwise the number they typed - staff check it at pickup.
  const pickupCoords = selectedAddress
    ? hasCoords(selectedAddress)
      ? { lat: selectedAddress.lat, lng: selectedAddress.lng }
      : null
    : hasCoords(addressForm)
      ? { lat: addressForm.lat as number, lng: addressForm.lng as number }
      : null;
  const locationKm = pickupCoords
    ? roadDistanceKm(distanceConfig.shopLat, distanceConfig.shopLng, pickupCoords.lat, pickupCoords.lng)
    : null;
  const manualKm = manualKmText.trim() === '' ? NaN : Number(manualKmText);
  const manualKmValid = Number.isFinite(manualKm) && manualKm >= 0 && manualKm <= 200;
  const distanceKnown = locationKm != null || manualKmValid;
  const customDistanceKm = locationKm ?? (manualKmValid ? Math.round(manualKm * 10) / 10 : 0);

  const draftNewAddress: Address = {
    id: 'ADDR-NEW',
    label: addressForm.label,
    houseFlat: addressForm.houseFlat.trim(),
    street: addressForm.street.trim(),
    area: addressForm.area.trim(),
    city: addressForm.city.trim() || 'Visakhapatnam',
    state: 'Andhra Pradesh',
    pincode: addressForm.pincode.trim(),
    landmark: addressForm.landmark.trim() || undefined,
    distanceKm: customDistanceKm,
    lat: addressForm.lat,
    lng: addressForm.lng,
  };
  const pickupAddressPreview: Address = selectedAddress
    ? { ...selectedAddress, distanceKm: customDistanceKm }
    : draftNewAddress;

  const distanceCalc = calculateDistanceCharge(customDistanceKm);
  const servicePrice = serviceType === 'GETTING' ? selectedGettingConfig?.price ?? 0 : 0; // Repair is inspection based
  const finalTotal = servicePrice + distanceCalc.charge;

  const availableDays = availability?.days || [];
  const pickupSlots = availabilityStatus === 'ready' ? availability?.settings?.pickupSlots || [] : [];
  const selectedDay = availableDays.find((d) => d.date === pickupDate);
  const tomorrowIso = (() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return toIsoDate(t);
  })();

  // ---------------------------------------------------------------- handlers
  const updateAddressForm = (patch: Partial<typeof emptyAddressForm>) =>
    setAddressForm((prev) => ({ ...prev, ...patch }));

  const handleFetchCurrentLocation = async () => {
    setLocationError(null);
    setFetchingLocation(true);
    try {
      const pos = await getCurrentLocation(15000);
      setAddressChoice('NEW');
      updateAddressForm({ lat: pos.lat, lng: pos.lng });
    } catch (err) {
      setLocationError(err instanceof LocationError ? err.message : "We couldn't get your location. Enter the distance below instead.");
    } finally {
      setFetchingLocation(false);
    }
  };

  const clearLocation = () => {
    setLocationError(null);
    if (selectedAddress) setAddressChoice('NEW');
    updateAddressForm({ lat: undefined, lng: undefined });
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    setPhotoError(null);
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS - batPhotos.length;
    if (room <= 0) {
      setPhotoError(`You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const picked = Array.from(files).slice(0, room);
    try {
      const urls = await Promise.all(picked.map((f) => fileToResizedDataUrl(f)));
      setBatPhotos((prev) => [...prev, ...urls].slice(0, MAX_PHOTOS));
    } catch (err: any) {
      setPhotoError(err?.message || 'Could not attach the photo.');
    }
  };

  const maxServiceKm = distanceConfig.maxServiceDistanceKm || 0;

  const validateStep = (step: number): string | null => {
    if (step === 2) {
      if (!batBrand.trim()) return 'Please enter your racket brand.';
      if (serviceType === 'GETTING') {
        if (activeTiers.length === 0) return 'No stringing packages are available right now. Please try again later.';
        if (stringTension < 15 || stringTension > 35) return 'Please choose a string tension between 15 and 35 lbs.';
        if (useCatalogue) {
          if (!selectedProductId) return "Please choose a string, or select \"I'll provide my own string\".";
          if (!ownString && selectedProduct) {
            if (!isProductSelectable(selectedProduct)) return `${productLabel(selectedProduct)} is out of stock.`;
            if (selectedProduct.variants.length > 0 && (!selectedVariant || !selectedVariant.inStock)) {
              return 'Please choose an in-stock colour for your string.';
            }
          }
        }
      } else if (!repairDescription.trim() && repairNeedsDescription) {
        return 'Please describe the damage.';
      }
    }
    if (step === 3) {
      if (addressChoice === 'NEW') {
        if (!addressForm.houseFlat.trim() || !addressForm.area.trim()) {
          return 'Please enter your house / flat and area for the pickup address.';
        }
        if (!/^\d{6}$/.test(addressForm.pincode.trim())) return 'Please enter a valid 6-digit pincode.';
      } else if (!selectedAddress) {
        return 'Please choose a pickup address.';
      }
      if (!distanceKnown) {
        return manualKmText.trim()
          ? 'Please enter the distance from the shop in km (0-200).'
          : "Tap 'Use my current location', or enter the distance from the shop in km.";
      }
      if (maxServiceKm > 0 && customDistanceKm > maxServiceKm) {
        return `Doorstep pickup is available within ${maxServiceKm} km of our shop. Please call ${phoneDisplay(shop.phone)} or drop your racket at the store.`;
      }
      if (availabilityStatus === 'loading') return 'Loading pickup availability, please wait a moment…';
      if (!pickupDate) return 'Please choose a pickup date.';
      if (availabilityStatus === 'ready') {
        if (!selectedDay || !selectedDay.available) return 'Please choose an available pickup date.';
        if (pickupSlots.length > 0 && !pickupSlot) return 'Please choose a preferred pickup time slot.';
      } else if (pickupDate < tomorrowIso) {
        return 'Please choose a future pickup date.';
      }
    }
    return null;
  };

  const handleNext = () => {
    const error = validateStep(currentStep);
    setStepError(error);
    if (error) return;
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    setStepError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const buildNotes = () => {
    const parts = [additionalNotes.trim()];
    if (pickupSlot) parts.push(`Preferred pickup slot: ${pickupSlot}`);
    return parts.filter(Boolean).join('\n');
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    for (const step of [2, 3]) {
      const error = validateStep(step);
      if (error) {
        setStepError(error);
        setCurrentStep(step);
        return;
      }
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitErrorIsDate(false);

    let pickupAddress: Address = pickupAddressPreview;
    if (addressChoice === 'NEW' && saveNewAddress) {
      const { id: _draftId, ...rest } = draftNewAddress;
      pickupAddress = addNewAddress({ ...rest, isDefault: savedAddresses.length === 0 });
      setAddressChoice(pickupAddress.id);
    }

    const isGetting = serviceType === 'GETTING';
    try {
      const saved = await addRequest({
        serviceType,
        customerName: userName,
        customerMobile: userMobile,
        batBrand: batBrand.trim(),
        batModel: batModel.trim(),
        batType,
        batPhotos,
        gettingType: isGetting ? gettingType : undefined,
        stringPreference: isGetting ? stringSummary.name : undefined,
        stringType: isGetting ? stringSummary.label : undefined,
        colour: isGetting && stringSummary.colour ? stringSummary.colour : undefined,
        stringTensionLbs: isGetting ? stringTension : undefined,
        gettingPrice: isGetting ? selectedGettingConfig?.price : undefined,
        repairIssue: !isGetting ? repairIssue : undefined,
        repairDescription: !isGetting ? repairDescription.trim() : undefined,
        pickupAddress: {
          ...pickupAddress,
          distanceKm: customDistanceKm,
          lat: pickupCoords?.lat,
          lng: pickupCoords?.lng,
          distanceSource: pickupCoords ? 'location' : 'customer',
        },
        distanceKm: customDistanceKm,
        pickupDate: pickupDate || undefined,
        additionalNotes: buildNotes(),
      });
      setSubmittedRequestId(saved.id);
      setCurrentStep(5);
      setWizardPrefill(null);
    } catch (err: any) {
      const status = err instanceof ApiError ? err.status : 0;
      setSubmitError(err?.message || 'Your request could not be submitted. Please try again.');
      if (status === 422 && /date|day|pickup|available|closed/i.test(err?.message || '')) {
        // The chosen day was rejected — refresh availability so the user can pick another.
        setSubmitErrorIsDate(true);
        loadAvailability();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const StepError = () =>
    stepError ? (
      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{stepError}</span>
      </div>
    ) : null;

  // ---------------------------------------------------------------- render
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Wizard progress: numbered steps joined by a line (labels hidden on phones, where the
          current step is spelled out above instead). */}
      <nav className="mb-8" aria-label="Booking steps">
        <p className="sm:hidden text-center text-sm text-slate-600 mb-3">
          Step {currentStep} of {WIZARD_STEPS.length} · <span className="font-semibold text-ink">{WIZARD_STEPS[currentStep - 1]}</span>
        </p>
        <ol className="flex items-start">
          {WIZARD_STEPS.map((name, idx) => {
            const stepNum = idx + 1;
            const isCompleted = currentStep > stepNum;
            const isCurrent = currentStep === stepNum;
            return (
              <li key={name} className="flex-1 flex flex-col items-center relative" aria-current={isCurrent ? 'step' : undefined}>
                {idx > 0 && (
                  <span
                    className={`absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 ${currentStep >= stepNum ? 'bg-ink' : 'bg-line'}`}
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold tabular-nums transition-colors duration-200 ${
                    isCompleted
                      ? 'bg-ink text-white'
                      : isCurrent
                      ? 'bg-accent text-ink ring-2 ring-ink ring-offset-2 ring-offset-paper'
                      : 'bg-white text-slate-500 border border-line'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" aria-hidden="true" /> : stepNum}
                  {isCompleted && <span className="sr-only"> (done)</span>}
                </span>
                <span
                  className={`hidden sm:block text-[13px] mt-2 ${
                    isCurrent ? 'text-ink font-semibold' : isCompleted ? 'text-slate-700' : 'text-slate-500'
                  }`}
                >
                  {name}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* STEP 1: SERVICE SELECTION */}
      {currentStep === 1 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="text-center max-w-lg mx-auto">
            <h1 className="font-display tracking-[0.01em] text-3xl font-bold text-slate-900">What do you need?</h1>
            <p className="text-sm text-slate-600 mt-1">Choose a service for your badminton racket.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="radiogroup" aria-label="Service">
            {[
              {
                type: 'GETTING' as ServiceType,
                title: 'Racket stringing',
                subtitle: 'Your string, colour and tension',
                icon: <Grid3x3 className="w-6 h-6" />,
                text: 'Pick a package, your string and colour from our current catalogue, and your tension.',
                price: tierPriceRange,
                note: tierTurnaround,
              },
              {
                type: 'REPAIR' as ServiceType,
                title: 'Racket repair',
                subtitle: 'Frame, shaft, joint, handle or grip',
                icon: <Wrench className="w-6 h-6" />,
                text: 'We inspect the racket and send you an itemised estimate. Work starts only after you approve it.',
                price: repairBaseFrom,
                note: 'Final price after inspection',
              },
            ].map((card) => {
              const selected = serviceType === card.type;
              return (
                <button
                  key={card.type}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setServiceType(card.type)}
                  className={`text-left p-5 rounded-2xl border-2 transition-all flex flex-col ${
                    selected
                      ? 'border-ink bg-paper shadow-md ring-2 ring-ink/40'
                      : 'border-line bg-white hover:border-line hover:shadow-md'
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex items-center gap-3">
                      <span
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                          card.type === 'REPAIR' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-paper border-line text-ink'
                        }`}
                      >
                        {card.icon}
                      </span>
                      <span>
                        <span className="block text-lg font-bold text-slate-900">{card.title}</span>
                        <span className="block text-xs text-slate-500">{card.subtitle}</span>
                      </span>
                    </span>
                    <span
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selected ? 'border-ink bg-ink text-white' : 'border-slate-300'
                      }`}
                    >
                      {selected && <CheckCircle2 className="w-4 h-4" />}
                    </span>
                  </span>
                  <span className="block text-xs text-slate-600 mt-3 leading-relaxed flex-1">{card.text}</span>
                  <span className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-800">{card.price}</span>
                    {card.note && <span className="text-slate-500">{card.note}</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleNext} size="lg" variant="primary" className="w-full sm:w-auto" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: BAT DETAILS */}
      {currentStep === 2 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="text-center max-w-lg mx-auto">
            <h2 className="font-display tracking-[0.01em] text-3xl font-bold text-slate-900">
              {serviceType === 'GETTING' ? 'Your racket & stringing' : 'Your racket & the damage'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {serviceType === 'GETTING'
                ? 'Tell us about your racket and how you would like it strung.'
                : 'Tell us about your racket and what needs fixing.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-line p-6 space-y-5 shadow-xs">
            {/* Brand & Model */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Racket brand *
                </label>
                <input
                  type="text"
                  value={batBrand}
                  onChange={(e) => setBatBrand(e.target.value)}
                  placeholder="e.g. Yonex, Li-Ning, Victor, Apacs..."
                  required
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Racket model <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={batModel}
                  onChange={(e) => setBatModel(e.target.value)}
                  placeholder="e.g. Astrox 99 Pro / Nanoflare 800"
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none font-medium"
                />
                <p className="mt-1.5 text-[13px] text-slate-500">Not sure? Leave it blank. We'll note it at pickup.</p>
              </div>
            </div>

            {/* Bat Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                Balance
              </label>
              <select
                value={batType}
                onChange={(e) => setBatType(e.target.value as BatType)}
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none font-medium"
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
              <div className="space-y-5 pt-2 border-t border-line/70">
                <label className="block text-sm font-semibold text-slate-800">
                  Stringing package *
                </label>
                {activeTiers.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    No stringing packages are available right now. Please check back later.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Stringing package">
                    {activeTiers.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={gettingType === item.name}
                        onClick={() => setGettingType(item.name as GettingType)}
                        className={`text-left p-4 rounded-2xl border-2 transition-all ${
                          gettingType === item.name
                            ? 'border-ink bg-paper shadow-xs'
                            : 'border-line bg-paper/50 hover:border-slate-300'
                        }`}
                      >
                        <span className="flex justify-between items-center gap-2 mb-1">
                          <span className="font-bold text-sm text-slate-900">{item.name}</span>
                          <span className="text-sm font-extrabold text-ink">
                            {item.price === 0 ? 'On request' : formatINR(item.price)}
                          </span>
                        </span>
                        <span className="block text-xs text-slate-500">{item.description}</span>
                        {item.turnaround && (
                          <span className="mt-2 text-xs text-emerald-700 font-semibold flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> Turnaround: {item.turnaround}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* String Tension */}
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    String tension
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="20"
                      max="32"
                      value={stringTension}
                      onChange={(e) => setStringTension(parseInt(e.target.value))}
                      className="w-full accent-ink"
                    />
                    <span className="px-3 py-1 bg-paper-deep text-ink font-black rounded-lg text-sm shrink-0">
                      {stringTension} lbs
                    </span>
                  </div>
                </div>

                {/* String selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-800">
                    String *
                  </label>

                  {prefillStringNotice && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{prefillStringNotice}</span>
                    </div>
                  )}

                  {catalogueStatus === 'loading' && (
                    <div className="p-4 rounded-2xl border border-line bg-paper text-xs text-slate-500 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading our string catalogue…
                    </div>
                  )}

                  {catalogueStatus === 'error' && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500">
                        Our live string catalogue isn't available right now — tell us which string you'd like and our
                        technician will confirm it at pickup.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={freeTextString}
                          onChange={(e) => setFreeTextString(e.target.value)}
                          placeholder="String (e.g. Yonex BG65) — leave empty for technician's choice"
                          className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none font-medium"
                        />
                        <input
                          type="text"
                          value={freeTextColour}
                          onChange={(e) => setFreeTextColour(e.target.value)}
                          placeholder="Preferred colour (optional)"
                          className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none font-medium"
                        />
                      </div>
                    </div>
                  )}

                  {catalogueStatus === 'ready' && (
                    <>
                      {catalogueBrands.length > 1 && (
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter strings by brand">
                          {['All', ...catalogueBrands].map((brand) => {
                            const active = stringBrandFilter === brand;
                            return (
                              <button
                                key={brand}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setStringBrandFilter(brand)}
                                className={`px-3 min-h-[40px] rounded-xl text-xs font-bold border transition-colors ${
                                  active
                                    ? 'bg-ink text-white border-ink'
                                    : 'bg-white text-slate-600 border-line hover:border-ink/30'
                                }`}
                              >
                                {brand === 'All' ? 'All brands' : brand}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="search"
                          value={stringSearch}
                          onChange={(e) => setStringSearch(e.target.value)}
                          placeholder="Search strings, e.g. BG65, Exbolt, 0.66"
                          aria-label="Search strings"
                          className="w-full pl-9 pr-3 min-h-[44px] rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-ink/40 outline-none bg-white"
                        />
                      </div>
                      {catalogue.some((p) => p.price == null) && (
                        <p className="text-xs text-slate-500">
                          Where no price is shown, the string is covered by your package price or confirmed by our stringer at pickup.
                        </p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[26rem] overflow-y-auto overscroll-contain p-1 -m-1 rounded-2xl">
                        {searchedCatalogue.length === 0 && (
                          <p className="sm:col-span-2 text-xs text-slate-500 p-3">No strings match your search.</p>
                        )}
                        {searchedCatalogue.map((product) => {
                          const selectable = isProductSelectable(product);
                          const isSelected = selectedProductId === product.id;
                          return (
                            <button
                              key={product.id}
                              type="button"
                              disabled={!selectable}
                              onClick={() => {
                                setSelectedProductId(product.id);
                                setPrefillStringNotice(null);
                                const stock = inStockVariants(product);
                                setSelectedVariantId(stock.length === 1 ? stock[0].id : '');
                              }}
                              className={`text-left p-4 rounded-2xl border-2 transition-all ${
                                !selectable
                                  ? 'border-line bg-paper opacity-60 cursor-not-allowed'
                                  : isSelected
                                  ? 'border-ink bg-paper shadow-xs'
                                  : 'border-line bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <span className="text-xs font-medium text-slate-500">
                                    {product.brand}
                                    {product.gauge ? ` • ${product.gauge}` : ''}
                                  </span>
                                  <p className="font-bold text-sm text-slate-900">{productLabel(product)}</p>
                                </div>
                                {product.price != null && (
                                  <span className="text-xs font-extrabold shrink-0 text-ink">{formatINR(product.price)}</span>
                                )}
                              </div>
                              {product.description && (
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{product.description}</p>
                              )}
                              <div className="mt-2 flex items-center gap-1.5">
                                {product.variants.slice(0, 8).map((v) => (
                                  <span
                                    key={v.id}
                                    title={`${v.colour}${v.inStock ? '' : ' (out of stock)'}`}
                                    className={`w-3.5 h-3.5 rounded-full border border-slate-300 ${v.inStock ? '' : 'opacity-30'}`}
                                    style={{ backgroundColor: v.colourHex || '#e2e8f0' }}
                                  />
                                ))}
                                {!selectable && (
                                  <span className="text-xs font-bold text-rose-600 ml-1">Out of stock</span>
                                )}
                              </div>
                            </button>
                          );
                        })}

                        {/* Customer-provided string */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductId(OWN_STRING);
                            setSelectedVariantId('');
                            setPrefillStringNotice(null);
                          }}
                          className={`text-left p-4 rounded-2xl border-2 border-dashed transition-all ${
                            ownString ? 'border-ink bg-paper' : 'border-slate-300 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-slate-500" />
                            <p className="font-bold text-sm text-slate-900">I'll provide my own string</p>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Hand your string set to our pickup agent along with the racket.
                          </p>
                        </button>
                      </div>

                      {ownString && (
                        <input
                          type="text"
                          value={ownStringNote}
                          onChange={(e) => setOwnStringNote(e.target.value)}
                          placeholder="Which string will you provide? (optional, e.g. Yonex BG80 White)"
                          className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none font-medium"
                        />
                      )}

                      {/* Colour choice for the selected product */}
                      {selectedProduct && selectedProduct.variants.length > 0 && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                            Colour for {productLabel(selectedProduct)} *
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {selectedProduct.variants.map((variant) => {
                              const isSelected = selectedVariantId === variant.id;
                              return (
                                <button
                                  key={variant.id}
                                  type="button"
                                  disabled={!variant.inStock}
                                  onClick={() => {
                                    setSelectedVariantId(variant.id);
                                    setPrefillStringNotice(null);
                                  }}
                                  className={`p-2 rounded-xl border text-left transition-all ${
                                    !variant.inStock
                                      ? 'border-line bg-paper opacity-60 cursor-not-allowed'
                                      : isSelected
                                      ? 'border-ink bg-paper ring-1 ring-ink/40 shadow-xs'
                                      : 'border-line hover:border-slate-300'
                                  }`}
                                >
                                  <div className="h-14 w-full rounded-lg overflow-hidden border border-line bg-slate-100 mb-1.5">
                                    {variant.imageUrl ? (
                                      <img
                                        src={variant.imageUrl}
                                        alt={`${productLabel(selectedProduct)} ${variant.colour}`}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div
                                        className="w-full h-full"
                                        style={{ backgroundColor: variant.colourHex || '#e2e8f0' }}
                                      />
                                    )}
                                  </div>
                                  <span className="block text-xs font-semibold text-slate-800">{variant.colour}</span>
                                  {!variant.inStock && (
                                    <span className="block text-xs font-bold text-rose-600">Out of stock</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* REPAIR SPECIFIC OPTIONS */}
            {serviceType === 'REPAIR' && (
              <div className="space-y-4 pt-4 border-t border-line/70">
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <p>
                    <b>Price after inspection.</b> The prices below are starting prices. After pickup our technician inspects the
                    racket and sends you an itemised estimate — you approve or decline it before any work starts.
                  </p>
                </div>

                <div>
                  <span className="block text-sm font-semibold text-slate-800 mb-1.5">What is the problem? *</span>
                  {activeCategories.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Repair problem">
                      {activeCategories.map((cat) => {
                        const selected = repairIssue === cat.name;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setRepairIssue(cat.name as RepairIssue)}
                            className={`text-left p-3 rounded-2xl border-2 transition-all ${
                              selected ? 'border-ink bg-paper' : 'border-line bg-white hover:border-slate-300'
                            }`}
                          >
                            <span className="flex justify-between items-baseline gap-2">
                              <span className="text-sm font-bold text-slate-900">{cat.name}</span>
                              {cat.basePrice > 0 && (
                                <span className="text-xs font-bold text-ink whitespace-nowrap">from {formatINR(cat.basePrice)}</span>
                              )}
                            </span>
                            {cat.description && <span className="block text-xs text-slate-500 mt-0.5 line-clamp-2">{cat.description}</span>}
                            {cat.turnaround && <span className="block text-xs text-emerald-700 font-semibold mt-1">Usually {cat.turnaround}</span>}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <select
                      value={repairIssue}
                      onChange={(e) => setRepairIssue(e.target.value as RepairIssue)}
                      className="w-full px-3.5 min-h-[44px] rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-ink/40 outline-none font-medium bg-white"
                    >
                      {['Broken Bat', 'Frame Damage', 'Shaft Damage', 'Handle Damage', 'Joint Damage', 'Grip Issue', 'Other'].map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label htmlFor="repair-description" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Describe the damage{repairNeedsDescription ? ' *' : ''}
                  </label>
                  <textarea
                    id="repair-description"
                    rows={3}
                    value={repairDescription}
                    onChange={(e) => setRepairDescription(e.target.value)}
                    placeholder="Where is the crack or problem, and how did it happen?"
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none font-medium"
                  />
                </div>
              </div>
            )}

            {/* Photos */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                Photos of the racket <span className="font-normal text-slate-500">(optional, up to {MAX_PHOTOS})</span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {batPhotos.map((photo, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-300">
                    <img src={photo} alt={`Racket photo ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setBatPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 w-7 h-7 flex items-center justify-center bg-slate-900/75 hover:bg-slate-900 text-white rounded-full"
                      aria-label={`Remove photo ${idx + 1}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {batPhotos.length < MAX_PHOTOS && (
                  <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-ink flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-ink transition-colors bg-paper">
                    <Upload className="w-5 h-5 mb-1" aria-hidden="true" />
                    <span className="text-xs font-semibold">Add photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handlePhotoUpload(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              {photoError && <p className="text-xs text-rose-600 mt-1">{photoError}</p>}
            </div>

            {/* Additional notes */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                Note for our pickup agent <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                type="text"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="e.g. Ring doorbell, call before arriving..."
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none font-medium"
              />
            </div>
          </div>

          <StepError />

          <div className="flex justify-between pt-4">
            <Button onClick={handleBack} variant="outline" size="lg" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
            <Button onClick={handleNext} variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: LOCATION, DISTANCE & PICKUP DATE */}
      {currentStep === 3 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="text-center max-w-lg mx-auto">
            <h2 className="font-display tracking-[0.01em] text-3xl font-bold text-slate-900">Pickup from your door</h2>
            <p className="text-sm text-slate-600 mt-1">
              Choose where and when we should collect your racket. Free pickup within {distanceConfig.freeRadiusKm} km.
            </p>
          </div>

          {/* Address choice */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-800">
              Pickup address
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {savedAddresses.map((addr) => {
                const isSelected = addressChoice === addr.id;
                return (
                  <button
                    key={addr.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setAddressChoice(addr.id);
                      setCustomDistanceKm(addr.distanceKm);
                    }}
                    className={`text-left p-4 rounded-2xl border-2 transition-all ${
                      isSelected ? 'border-ink bg-paper shadow-xs' : 'border-line bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-ink bg-paper-deep px-2 py-0.5 rounded-md">
                        {addr.label}
                      </span>
                      <span className="text-xs font-bold text-slate-700">About {addr.distanceKm} km</span>
                    </span>
                    <span className="block text-xs font-semibold text-slate-800 mt-2">{addr.houseFlat}</span>
                    <span className="block text-xs text-slate-500 mt-0.5 leading-snug">
                      {[addr.street, addr.area, addr.pincode].filter(Boolean).join(', ')}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                aria-checked={addressChoice === 'NEW'}
                onClick={() => setAddressChoice('NEW')}
                className={`p-4 min-h-[56px] rounded-2xl border-2 border-dashed transition-all flex items-center justify-center text-xs font-bold ${
                  addressChoice === 'NEW' ? 'border-ink bg-paper text-ink' : 'border-slate-300 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span aria-hidden="true">+</span>&nbsp;{savedAddresses.length > 0 ? 'Use a new address' : 'Enter the pickup address'}
              </button>
            </div>

            {addressChoice === 'NEW' && (
              <div className="bg-white rounded-2xl border border-line p-4 space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-2">
                  {(['Home', 'Office', 'Other'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => updateAddressForm({ label: l })}
                      className={`min-h-[40px] rounded-xl font-bold border transition-all ${
                        addressForm.label === l ? 'bg-ink text-white border-ink' : 'border-line text-slate-600 hover:bg-paper'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={addressForm.houseFlat}
                  onChange={(e) => updateAddressForm({ houseFlat: e.target.value })}
                  placeholder="Flat / House / Court name *"
                  aria-label="Flat / House / Court name"
                  autoComplete="address-line1"
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none"
                />
                <input
                  type="text"
                  value={addressForm.street}
                  onChange={(e) => updateAddressForm({ street: e.target.value })}
                  placeholder="Street / Road"
                  aria-label="Street / Road"
                  autoComplete="address-line2"
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={addressForm.area}
                    onChange={(e) => updateAddressForm({ area: e.target.value })}
                    placeholder="Area / Locality *"
                  aria-label="Area / Locality"
                  autoComplete="address-level3"
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none"
                  />
                  <input
                    type="text"
                    value={addressForm.city}
                    onChange={(e) => updateAddressForm({ city: e.target.value })}
                    placeholder="City"
                  aria-label="City"
                  autoComplete="address-level2"
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={addressForm.pincode}
                    onChange={(e) => updateAddressForm({ pincode: e.target.value.replace(/\D/g, '') })}
                    placeholder="Pincode *"
                  aria-label="Pincode"
                  autoComplete="postal-code"
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={addressForm.landmark}
                  onChange={(e) => updateAddressForm({ landmark: e.target.value })}
                  placeholder="Landmark (optional)"
                  aria-label="Landmark (optional)"
                  autoComplete="off"
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none"
                />
                <label className="flex items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={saveNewAddress}
                    onChange={(e) => setSaveNewAddress(e.target.checked)}
                    className="accent-ink"
                  />
                  Save this address for future bookings
                </label>
              </div>
            )}
          </div>

          {/* Distance */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-800">
              Distance from our shop
            </label>
            <div className="bg-paper border border-line rounded-2xl p-4 space-y-3 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2.5 bg-ink text-white rounded-xl shadow-xs mt-0.5 shrink-0">
                    <Locate className={`w-5 h-5 ${fetchingLocation ? 'animate-spin' : ''}`} />
                  </div>
                  <div className="min-w-0">
                    {locationKm != null ? (
                      <>
                        <p className="text-sm font-bold text-slate-900">About {locationKm} km from the shop</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {selectedAddress ? `Saved location of your ${selectedAddress.label} address. ` : 'From your current location. '}
                          {maxServiceKm > 0 && locationKm > maxServiceKm
                            ? 'Outside our pickup area.'
                            : distanceCalc.isFree
                              ? 'Pickup & delivery is free.'
                              : `Pickup & delivery: ${formatINR(distanceCalc.charge)}.`}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-slate-900">Use my current location</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Do this at the pickup address. We use your location only to work out the distance and the delivery
                          charge.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {locationKm != null && (
                    <Button type="button" variant="outline" size="sm" className="min-h-[40px]" onClick={clearLocation}>
                      Enter distance instead
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handleFetchCurrentLocation}
                    disabled={fetchingLocation}
                    variant="primary"
                    size="sm"
                    className="min-h-[40px]"
                    leftIcon={<Locate className="w-4 h-4" />}
                  >
                    {fetchingLocation ? 'Finding your location…' : locationKm != null ? 'Update location' : 'Use my current location'}
                  </Button>
                </div>
              </div>
              {locationError && (
                <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {locationError}
                </p>
              )}
              {locationKm == null && (
                <div className="pt-3 border-t border-line">
                  <label htmlFor="pickup-distance-km" className="block text-xs font-semibold text-slate-700">
                    Distance from the shop (km)
                  </label>
                  <input
                    id="pickup-distance-km"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={200}
                    step={0.1}
                    value={manualKmText}
                    onChange={(e) => setManualKmText(e.target.value)}
                    placeholder="e.g. 6"
                    className="mt-1 w-full sm:w-40 px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none"
                  />
                  <p className="text-xs text-slate-600 mt-1.5">
                    We&apos;ll check the distance when we pick up your racket; if it&apos;s different, the delivery charge is
                    corrected before you pay.
                  </p>
                </div>
              )}
            </div>
            {distanceKnown && (
              <MapSimulation distanceKm={customDistanceKm} sourceLabel={locationKm != null ? 'from your location' : 'entered by you'} />
            )}
            {distanceKnown && maxServiceKm > 0 && customDistanceKm > maxServiceKm && (
              <div role="alert" className="p-3 rounded-2xl border border-rose-200 bg-rose-50 text-sm text-rose-800">
                <p className="font-bold">This address is outside our pickup area ({maxServiceKm} km).</p>
                <p className="mt-0.5">
                  Please call{' '}
                  <a href={telHref(shop.phone)} className="font-bold underline">
                    {phoneDisplay(shop.phone)}
                  </a>{' '}
                  or drop your racket at our store.
                </p>
              </div>
            )}
          </div>

          {/* Pickup date */}
          <div className="bg-white rounded-2xl border border-line p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-ink" />
              <label className="text-sm font-semibold text-slate-800">Pickup day</label>
            </div>

            {prefillDateNotice && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">{prefillDateNotice}</div>
            )}

            {availabilityStatus === 'loading' && (
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking pickup availability…
              </div>
            )}

            {availabilityStatus === 'error' && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Live pickup availability couldn't be loaded. Pick your preferred date — we'll confirm it with you.
                </p>
                <input
                  type="date"
                  min={tomorrowIso}
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-ink/40 outline-none"
                />
              </div>
            )}

            {availabilityStatus === 'ready' && availability && (
              <>
                {availability.settings?.notice && (
                  <div className="p-3 rounded-xl bg-paper border border-line text-xs text-ink flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-ink shrink-0 mt-0.5" />
                    <span>{availability.settings.notice}</span>
                  </div>
                )}
                {availableDays.length === 0 ? (
                  <p className="text-xs text-slate-500">No pickup days are open for booking right now.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2 max-h-72 overflow-y-auto pr-1">
                    {availableDays.map((day) => {
                      const isSelected = pickupDate === day.date;
                      return (
                        <button
                          key={day.date}
                          type="button"
                          disabled={!day.available}
                          title={day.available ? undefined : day.reason || 'Unavailable'}
                          onClick={() => {
                            setPickupDate(day.date);
                            setPrefillDateNotice(null);
                            setSubmitError(null);
                          }}
                          className={`p-2 min-h-[64px] rounded-xl border text-center transition-all ${
                            !day.available
                              ? 'border-line/70 bg-paper text-slate-400 cursor-not-allowed'
                              : isSelected
                              ? 'border-ink bg-ink text-white shadow-xs'
                              : 'border-line text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <span className="block text-xs font-medium">
                            {formatDay(day.date, { weekday: 'short' })}
                          </span>
                          <span className="block text-base font-semibold tabular-nums">{formatDay(day.date, { day: 'numeric' })}</span>
                          <span className="block text-xs">{formatDay(day.date, { month: 'short' })}</span>
                          {!day.available && (
                            <span className="block text-xs leading-tight mt-0.5 truncate">{day.reason || 'Unavailable'}</span>
                          )}
                          {day.available && day.remaining != null && (
                            <span className={`block text-xs leading-tight mt-0.5 ${isSelected ? 'text-white/75' : 'text-emerald-600'}`}>
                              {day.remaining} left
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {pickupSlots.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Clock className="w-4 h-4 text-ink" />
                      <span className="text-sm font-semibold text-slate-800">Pickup time</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pickupSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setPickupSlot(slot)}
                          className={`px-3 min-h-[40px] rounded-xl border text-xs font-semibold transition-all ${
                            pickupSlot === slot
                              ? 'border-ink bg-paper text-ink ring-1 ring-ink/40'
                              : 'border-line text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {pickupDate && (
              <p className="text-xs text-slate-700">
                Selected: <b>{formatDay(pickupDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b>
                {pickupSlot ? ` • ${pickupSlot}` : ''}
              </p>
            )}
          </div>

          <StepError />

          <div className="flex justify-between pt-4">
            <Button onClick={handleBack} variant="outline" size="lg" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
            <Button onClick={handleNext} variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Review booking
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: REQUEST REVIEW */}
      {currentStep === 4 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="text-center max-w-lg mx-auto">
            <h2 className="font-display tracking-[0.01em] text-3xl font-bold text-slate-900">Check and book</h2>
            <p className="text-sm text-slate-600 mt-1">
              Check the details below. Nothing to pay now — you pay when your racket comes back.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-line p-6 space-y-6 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-4 bg-paper rounded-2xl border border-line/70 space-y-2">
                <span className="text-xs font-semibold text-slate-500">Service</span>
                <h4 className="text-base font-bold text-slate-900">
                  {serviceType === 'GETTING' ? gettingType : `Repair: ${repairIssue}`}
                </h4>
                {serviceType === 'GETTING' ? (
                  <div className="text-xs text-slate-600 space-y-1">
                    <p>
                      String: <b>{stringSummary.name}</b>
                      {useCatalogue && !ownString && (
                        <span className="text-slate-500">
                          {' '}
                          {stringSummary.price != null ? `— ${formatINR(stringSummary.price)}` : ''}
                        </span>
                      )}
                    </p>
                    {stringSummary.colour && (
                      <p>
                        Colour: <b>{stringSummary.colour}</b>
                      </p>
                    )}
                    <p>
                      Tension: <b>{stringTension} lbs</b>
                    </p>
                    {selectedGettingConfig?.turnaround && (
                      <p>
                        Turnaround: <b>{selectedGettingConfig.turnaround}</b>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 space-y-1">
                    <p>
                      Issue: <b>{repairIssue}</b>
                    </p>
                    {selectedCategory?.turnaround && (
                      <p>
                        Usual turnaround: <b>{selectedCategory.turnaround}</b> after pickup
                      </p>
                    )}
                    {selectedCategory && selectedCategory.basePrice > 0 && (
                      <p>
                        Starting price: <b>{formatINR(selectedCategory.basePrice)}</b>
                      </p>
                    )}
                    <p className="text-amber-800 font-semibold">Final price after we inspect the racket</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-paper rounded-2xl border border-line/70 space-y-2">
                <span className="text-xs font-semibold text-slate-500">Racket</span>
                <h4 className="text-base font-bold text-slate-900">
                  {batBrand} {batModel}
                </h4>
                <div className="text-xs text-slate-600 space-y-1">
                  <p>
                    Balance: <b>{batType}</b>
                  </p>
                  <p>
                    Name: <b>{userName || 'You'}</b>
                  </p>
                  {userMobile && (
                    <p>
                      Mobile: <b>{formatMobile(userMobile)}</b>{' '}
                      <span className="text-slate-500">— our pickup agent calls this number</span>
                    </p>
                  )}
                  {additionalNotes.trim() && (
                    <p>
                      Notes: <i>"{additionalNotes.trim()}"</i>
                    </p>
                  )}
                  {batPhotos.length > 0 && <p>Photos: {batPhotos.length} attached</p>}
                </div>
              </div>
            </div>

            {/* Location & Date Summary */}
            <div className="p-4 bg-paper rounded-2xl border border-line space-y-1 text-xs">
              <div className="flex justify-between items-center font-bold text-slate-800 mb-1">
                <span>Pickup address</span>
                <span className="text-ink">About {customDistanceKm} km from the shop</span>
              </div>
              <p className="text-slate-700">
                {[pickupAddressPreview.houseFlat, pickupAddressPreview.street, pickupAddressPreview.area, pickupAddressPreview.city]
                  .filter(Boolean)
                  .join(', ')}
                {pickupAddressPreview.pincode ? ` - ${pickupAddressPreview.pincode}` : ''}
              </p>
              {pickupAddressPreview.landmark && (
                <p className="text-slate-500 text-xs mt-1">Landmark: {pickupAddressPreview.landmark}</p>
              )}
              <div className="flex justify-between items-center font-bold text-slate-800 pt-2">
                <span>Pickup</span>
                <span className="text-ink">
                  {pickupDate ? formatDay(pickupDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  {pickupSlot ? ` • ${pickupSlot}` : ''}
                </span>
              </div>
            </div>

            {/* Charges */}
            <div className="bg-paper rounded-2xl p-4 divide-y divide-line text-xs space-y-2.5">
              <div className="flex justify-between items-center text-slate-700 pb-1">
                <span>{serviceType === 'GETTING' ? 'Stringing' : 'Repair'}</span>
                {serviceType === 'GETTING' ? (
                  <span className="font-semibold text-slate-900">{formatINR(servicePrice)}</span>
                ) : (
                  <span className="font-semibold text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded-md">
                    To be confirmed after inspection
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center text-slate-700 pt-2">
                <span>Pickup &amp; delivery</span>
                {distanceCalc.isFree ? (
                  <span className="font-semibold text-emerald-700">Free (within {distanceConfig.freeRadiusKm} km)</span>
                ) : (
                  <span className="font-semibold text-slate-900">
                    {formatINR(distanceCalc.charge)}
                    {distanceConfig.pricingMethod !== 'SLAB' &&
                      ` (${distanceCalc.chargeableKm} km × ${formatINR(distanceConfig.perKmRateBeyondFree)})`}
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center pt-3 text-base font-extrabold text-ink">
                <span>Total, paid on delivery</span>
                {serviceType === 'GETTING' ? (
                  <span className="text-2xl text-ink">{formatINR(finalTotal)}</span>
                ) : (
                  <span className="text-sm font-bold text-amber-800">
                    {distanceCalc.charge > 0 ? `${formatINR(distanceCalc.charge)} + repair price` : 'Repair price after inspection'}
                  </span>
                )}
              </div>
              {serviceType === 'GETTING' && useCatalogue && !ownString && stringSummary.price != null && (
                <p className="pt-2 text-xs text-slate-500">
                  String list price {formatINR(stringSummary.price)}. The final bill is confirmed by our stringer at pickup.
                </p>
              )}
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-emerald-950 mb-0.5">Nothing to pay now</p>
                <p className="leading-relaxed">Pay on delivery — cash or UPI, after you have checked your racket.</p>
              </div>
            </div>
          </div>

          {submitError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {submitError}
              </span>
              {submitErrorIsDate && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPickupDate('');
                    setCurrentStep(3);
                  }}
                >
                  Change pickup date
                </Button>
              )}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              onClick={handleBack}
              variant="outline"
              size="lg"
              disabled={isSubmitting}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              variant="accent"
              size="lg"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="px-8"
              rightIcon={<CheckCircle2 className="w-5 h-5" />}
            >
              {isSubmitting ? 'Booking…' : serviceType === 'GETTING' ? 'Book stringing' : 'Book a repair'}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 5: CONFIRMATION */}
      {currentStep === 5 && submittedRequestId && (
        <div className="text-center py-8 max-w-lg mx-auto space-y-6 animate-in zoom-in-95">
          <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
          </div>

          <div role="status">
            <h2 className="font-display tracking-[0.01em] text-3xl sm:text-4xl font-bold text-slate-900">Booked — thank you</h2>
            <p className="text-sm text-slate-600 mt-1.5">
              Your request number is{' '}
              <b className="text-ink font-semibold text-base tabular-nums">{submittedRequestId}</b>. We will call you before pickup.
            </p>
          </div>

          {serviceType === 'REPAIR' && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 text-left">
              <p className="font-bold mb-1">What happens next</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-700">
                <li>Our agent collects your racket on the pickup day you chose.</li>
                <li>Our technician inspects the damage at the shop.</li>
                <li>The itemised estimate appears on this request under <b>My requests</b>.</li>
                <li>Repair begins only after you approve it.</li>
              </ul>
            </div>
          )}

          <div className="p-4 bg-paper rounded-2xl border border-line text-xs text-slate-600 space-y-1 text-left">
            <div className="flex justify-between">
              <span>Name</span>
              <span className="font-semibold text-slate-900">{userName}</span>
            </div>
            {userMobile && (
              <div className="flex justify-between">
                <span>Mobile</span>
                <span className="font-semibold text-slate-900">{formatMobile(userMobile)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Racket</span>
              <span className="font-semibold text-slate-900">
                {batBrand} {batModel}
              </span>
            </div>
            {pickupDate && (
              <div className="flex justify-between">
                <span>Pickup</span>
                <span className="font-semibold text-slate-900">
                  {formatDay(pickupDate)}
                  {pickupSlot ? ` • ${pickupSlot}` : ''}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Distance</span>
              <span className="font-semibold text-slate-900">
                {customDistanceKm} km ({distanceCalc.isFree ? 'free' : formatINR(distanceCalc.charge)})
              </span>
            </div>
            <div className="flex justify-between">
              <span>Payment</span>
              <span className="font-semibold text-slate-900">Pay on delivery — cash or UPI</span>
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
              Track this request
            </Button>
            <Button onClick={() => setCustomerSubView('dashboard')} className="flex-1" size="lg" variant="outline">
              Go to dashboard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
