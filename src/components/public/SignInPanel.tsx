import React, { useEffect, useState } from 'react';
import { AlertCircle, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { Button } from '../common/Button';
import { MobileInput, OtpCodeInput, useResendCountdown } from '../common/MobileInput';
import { authService, AuthSession } from '../../services/authService';
import { formatMobile, normalizeMobile, INVALID_MOBILE_MESSAGE } from '../../utils/phone';
import { phoneDisplay, telHref, useShopSettings } from '../../hooks/useShopSettings';

/**
 * The three ways to sign in (shared by the sign-in dialog and the sign-in page):
 *   Customer — mobile number + 6-digit SMS code (new numbers then enter their name)
 *   Staff    — mobile number + password (set by the admin)
 *   Admin    — mobile number + password
 */

const RESEND_SECONDS = 30;

export const ROLE_TABS: { role: UserRole; label: string }[] = [
  { role: 'CUSTOMER', label: 'Customer' },
  { role: 'EMPLOYEE', label: 'Staff' },
  { role: 'ADMIN', label: 'Admin' },
];

type CustomerStage = 'MOBILE' | 'OTP' | 'PROFILE';

/** Drop a half-finished new-customer session (number verified, name not given yet). */
export const discardPendingSignup = () => {
  if (authService.getStoredSession()?.isNewCustomer) authService.clearStoredSession();
};

export const signInHeading = (role: UserRole, stage: CustomerStage, mobile: string | null) => {
  if (role === 'EMPLOYEE') return { title: 'Staff sign in', text: 'Use your mobile number and the password the admin set for you.' };
  if (role === 'ADMIN') return { title: 'Admin sign in', text: 'Use your mobile number and password.' };
  if (stage === 'OTP') return { title: 'Enter the code', text: `We sent a 6-digit code by SMS to ${formatMobile(mobile)}.` };
  if (stage === 'PROFILE') return { title: 'What is your name?', text: `${formatMobile(mobile)} is verified. Add your name to finish.` };
  return { title: 'Sign in', text: "Use your mobile number — we'll send a 6-digit code by SMS. New customers sign up the same way." };
};

const inputCls =
  'w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-base sm:text-sm text-slate-900 bg-white focus:ring-2 focus:ring-ink/40 focus:border-ink outline-none';
const labelCls = 'block text-xs font-bold text-slate-700 mb-1';

interface SignInPanelProps {
  role: UserRole;
  /** Which tabs to offer: none, Staff/Admin only, or all three. */
  tabs: 'none' | 'staff' | 'all';
  onRoleChange: (role: UserRole) => void;
  /** Customer step, so the surrounding dialog/page can show the right heading. */
  onStageChange?: (stage: CustomerStage, mobile: string | null) => void;
}

export const SignInPanel: React.FC<SignInPanelProps> = ({ role, tabs, onRoleChange, onStageChange }) => {
  const { completeLogin, pendingWizardLaunch, wizardPrefill } = useApp();
  const shop = useShopSettings();

  const [stage, setStage] = useState<CustomerStage>('MOBILE');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [testCode, setTestCode] = useState<{ code: string; smsSent: boolean } | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, startResendCountdown, resetResendCountdown] = useResendCountdown(RESEND_SECONDS);

  const verifiedMobile = normalizeMobile(mobile);

  useEffect(() => {
    onStageChange?.(stage, verifiedMobile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, verifiedMobile]);

  // Switching role starts over (and never keeps a typed password).
  useEffect(() => {
    discardPendingSignup();
    setStage('MOBILE');
    setOtp('');
    setTestCode(null);
    setPassword('');
    setError(null);
    resetResendCountdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Leaving half-way through a new-customer sign-up must not leave a session behind.
  useEffect(() => () => discardPendingSignup(), []);

  const requestCode = async (phone: string) => {
    const res = await authService.requestOtp(phone);
    if (res && res.success === false) throw new Error(res.message || 'Could not send the code.');
    startResendCountdown();
    setOtp('');
    // Only a test server (SMS not set up) returns the code itself.
    setTestCode(res?.otp ? { code: res.otp, smsSent: !!res.smsSent } : null);
  };

  const handleCustomerSession = (session: AuthSession) => {
    if (session.isNewCustomer) {
      setName(session.name || '');
      setStage('PROFILE');
      return;
    }
    completeLogin(session);
  };

  const submitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (stage === 'MOBILE') {
      if (!verifiedMobile) return setError(INVALID_MOBILE_MESSAGE);
      setBusy(true);
      try {
        await requestCode(verifiedMobile);
        setStage('OTP');
      } catch (err: any) {
        setError(err?.message || 'Could not send the SMS code. Please try again.');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (stage === 'OTP') {
      if (!verifiedMobile) {
        setStage('MOBILE');
        return setError(INVALID_MOBILE_MESSAGE);
      }
      if (otp.length < 6) return setError('Enter the 6-digit code from the SMS.');
      setBusy(true);
      try {
        const session = await authService.login({ phone: verifiedMobile, otp: otp.trim(), role: 'CUSTOMER' });
        handleCustomerSession(session);
      } catch (err: any) {
        setError(err?.message || 'That code did not work. Check the SMS and try again.');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!name.trim()) return setError('Please enter your name.');
    setBusy(true);
    try {
      const session = await authService.register({ name: name.trim(), address: address.trim() });
      completeLogin(session);
    } catch (err: any) {
      setError(err?.message || 'Could not create your account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!verifiedMobile || resendIn > 0) return;
    setError(null);
    setResending(true);
    try {
      await requestCode(verifiedMobile);
    } catch (err: any) {
      setError(err?.message || 'Could not resend the code.');
    } finally {
      setResending(false);
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!verifiedMobile) return setError(INVALID_MOBILE_MESSAGE);
    if (!password) return setError('Please enter your password.');
    setBusy(true);
    try {
      const session = await authService.login({ phone: verifiedMobile, password, role });
      setPassword('');
      completeLogin(session);
    } catch (err: any) {
      setError(err?.message || 'Wrong mobile number or password.');
    } finally {
      setBusy(false);
    }
  };

  const tabList = tabs === 'all' ? ROLE_TABS : tabs === 'staff' ? ROLE_TABS.filter((t) => t.role !== 'CUSTOMER') : [];

  return (
    <div className="space-y-4">
      {tabList.length > 0 && (
        <div role="tablist" aria-label="Sign in as" className={`grid ${tabList.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-1 p-1 rounded-xl bg-slate-100`}>
          {tabList.map((t) => (
            <button
              key={t.role}
              type="button"
              role="tab"
              aria-selected={role === t.role}
              onClick={() => onRoleChange(t.role)}
              className={`min-h-[44px] rounded-lg text-sm font-bold transition-colors ${
                role === t.role ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}

      {role === 'CUSTOMER' ? (
        <form onSubmit={submitCustomer} className="space-y-4" noValidate>
          {stage === 'MOBILE' && (
            <>
              {pendingWizardLaunch && (
                <p className="p-3 rounded-xl bg-paper border border-line text-sm text-ink">
                  Sign in to finish your {wizardPrefill?.serviceType === 'REPAIR' ? 'repair' : 'stringing'} booking
                  {wizardPrefill?.batBrand ? ` for ${wizardPrefill.batBrand} ${wizardPrefill.batModel || ''}`.trimEnd() : ''}.
                </p>
              )}
              <div className="[&>div]:min-h-[44px]">
                <label htmlFor="signin-customer-mobile" className={labelCls}>
                  Mobile number
                </label>
                <MobileInput
                  id="signin-customer-mobile"
                  value={mobile}
                  onChange={(v) => {
                    setMobile(v);
                    setError(null);
                  }}
                  autoFocus
                  required
                />
              </div>
            </>
          )}

          {stage === 'OTP' && (
            <>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label htmlFor="signin-customer-otp" className="text-xs font-bold text-slate-700">
                    6-digit code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStage('MOBILE');
                      setOtp('');
                      setTestCode(null);
                      setError(null);
                      resetResendCountdown();
                    }}
                    className="min-h-[44px] px-1 text-sm font-semibold text-ink hover:underline"
                  >
                    Change number
                  </button>
                </div>
                <OtpCodeInput
                  id="signin-customer-otp"
                  value={otp}
                  onChange={(v) => {
                    setOtp(v);
                    setError(null);
                  }}
                  autoFocus
                />
              </div>
              {testCode && (
                <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                  {testCode.smsSent ? 'Test server: the code is also shown here' : "SMS isn't set up on this server"} — your code is{' '}
                  <b className="font-mono tracking-wider">{testCode.code}</b>.
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-500">No SMS?</span>
                {resendIn > 0 ? (
                  <span className="text-slate-500" aria-live="polite">
                    Resend in 0:{String(resendIn).padStart(2, '0')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={resend}
                    disabled={resending}
                    className="min-h-[44px] px-1 font-semibold text-ink hover:underline inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} /> Send a new code
                  </button>
                )}
              </div>
            </>
          )}

          {stage === 'PROFILE' && (
            <>
              <div>
                <label htmlFor="signin-name" className={labelCls}>
                  Your name
                </label>
                <input
                  id="signin-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  autoFocus
                  required
                  maxLength={80}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="signin-address" className={labelCls}>
                  Pickup address <span className="font-medium text-slate-400">(optional — you can add it when booking)</span>
                </label>
                <textarea
                  id="signin-address"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoComplete="street-address"
                  placeholder="House / flat, street, area, pincode"
                  className={`${inputCls} py-2.5 resize-none`}
                />
              </div>
            </>
          )}

          <Button type="submit" variant="primary" size="lg" isLoading={busy} className="w-full min-h-[48px]">
            {stage === 'MOBILE' ? 'Send code' : stage === 'OTP' ? 'Verify and sign in' : 'Create account'}
          </Button>
          <p className="text-xs text-slate-500 text-center">
            Trouble signing in? Call the shop on{' '}
            <a href={telHref(shop.phone)} className="inline-flex items-center min-h-[44px] font-semibold text-ink whitespace-nowrap">
              {phoneDisplay(shop.phone)}
            </a>
            .
          </p>
        </form>
      ) : (
        <form onSubmit={submitPassword} className="space-y-4" noValidate>
          <div className="[&>div]:min-h-[44px]">
            <label htmlFor="signin-staff-mobile" className={labelCls}>
              Mobile number
            </label>
            <MobileInput
              id="signin-staff-mobile"
              value={mobile}
              onChange={(v) => {
                setMobile(v);
                setError(null);
              }}
              autoFocus
              required
            />
          </div>
          <div>
            <label htmlFor="signin-password" className={labelCls}>
              Password
            </label>
            <div className="relative">
              <input
                id="signin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                autoComplete="current-password"
                required
                className={`${inputCls} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-0 top-0 w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" variant="primary" size="lg" isLoading={busy} className="w-full min-h-[48px]">
            Sign in
          </Button>
          <p className="text-xs text-slate-500 text-center">
            {role === 'EMPLOYEE' ? 'Forgot your password? Ask the admin to reset it.' : 'Forgot your password? Another admin can reset it.'}
          </p>
        </form>
      )}
    </div>
  );
};
