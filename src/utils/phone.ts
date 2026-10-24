/**
 * Indian mobile-number helpers. Mirrors the backend rule
 * (backend/app/services/sms_service.py: normalize_phone):
 * a 10-digit number starting with 6-9, optionally prefixed by +91 / 91 / 0,
 * with any spaces, dashes or brackets.
 */

/** Returns "+91XXXXXXXXXX" for a valid Indian mobile number, else null. */
export function normalizeMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  return null;
}

/** "+919876543210" (or any valid format) -> "+91 98765 43210". Anything else is returned trimmed/unchanged. */
export function formatMobile(raw: string | null | undefined): string {
  if (!raw) return '';
  const normalized = normalizeMobile(raw);
  if (!normalized) return String(raw).trim();
  return `+91 ${normalized.slice(3, 8)} ${normalized.slice(8)}`;
}

/** The 10 local digits of a valid mobile ("9876543210"), or '' when invalid. */
export function localMobileDigits(raw: string | null | undefined): string {
  const normalized = normalizeMobile(raw);
  return normalized ? normalized.slice(3) : '';
}

/** href for a tel: link, or undefined when the number is not a valid mobile. */
export function mobileTelHref(raw: string | null | undefined): string | undefined {
  const normalized = normalizeMobile(raw);
  return normalized ? `tel:${normalized}` : undefined;
}

/**
 * Sanitises what the user types into a "+91" mobile field: keeps digits only,
 * drops a pasted +91 / 0 prefix, caps at 10 digits.
 */
export function sanitizeMobileInput(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export const INVALID_MOBILE_MESSAGE = 'Enter a valid 10-digit Indian mobile number (starting with 6, 7, 8 or 9).';
