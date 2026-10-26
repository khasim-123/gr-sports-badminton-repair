import { useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import type { WizardPrefill } from '../../../types';
import type { RepairRequest, StringingRequest } from './BookingSection';

/** The booking form's stringing answers → the booking wizard's prefill. */
export function stringingPrefill(r: StringingRequest): Partial<WizardPrefill> {
  const prefill: Partial<WizardPrefill> = {};
  if (r.brand) prefill.batBrand = r.brand;
  if (r.model) prefill.batModel = r.model;
  if (r.stringName) prefill.stringType = r.stringName;
  if (r.stringName && r.colour) prefill.stringColour = r.colour;
  if (r.tension && r.tension >= 10 && r.tension <= 40) prefill.stringTension = r.tension;
  if (r.pickupDate) prefill.pickupDate = r.pickupDate;
  return prefill;
}

/** The booking form's repair answers → the booking wizard's prefill. */
export function repairPrefill(r: RepairRequest): Partial<WizardPrefill> {
  const prefill: Partial<WizardPrefill> = {};
  if (r.category) prefill.repairIssue = r.category; // a live repair category name; the wizard maps it
  if (r.notes) prefill.repairDescription = r.notes;
  if (r.brand) prefill.batBrand = r.brand;
  if (r.model) prefill.batModel = r.model;
  if (r.pickupDate) prefill.pickupDate = r.pickupDate;
  return prefill;
}

/** "Continue" from a booking form: log in if needed, then the booking wizard with the answers filled in. */
export function useBookingWizard() {
  const { openWizardWithService } = useApp();
  const bookStringing = useCallback((req: StringingRequest) => openWizardWithService('GETTING', stringingPrefill(req)), [openWizardWithService]);
  const bookRepair = useCallback((req: RepairRequest) => openWizardWithService('REPAIR', repairPrefill(req)), [openWizardWithService]);
  return { bookStringing, bookRepair };
}
