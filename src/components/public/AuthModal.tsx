import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Mail, KeyRound, ArrowRight, RefreshCw, AlertCircle, CheckCircle2, User, Phone, MapPin } from 'lucide-react';
import { Button } from '../common/Button';

export const AuthModal: React.FC = () => {
  const { authModalOpen, setAuthModalOpen, loginWithEmailOtp, addToast } = useApp();

  const [step, setStep] = useState<'EMAIL' | 'OTP' | 'PROFILE'>('EMAIL');
  const [email, setEmail] = useState('vikram.m@example.com');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('Vikram Malhotra');
  const [mobile, setMobile] = useState('+91 99887 76655');
  const [address, setAddress] = useState('Flat 402, Green Glen, Bellandur, Bengaluru');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(45);
  const [isNewUser, setIsNewUser] = useState(false);

  if (!authModalOpen) return null;

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setStep('OTP');
      setOtp('849201'); // Pre-fill sample for smooth demonstration
      addToast('info', 'OTP Sent!', `A 6-digit verification code has been dispatched to ${email}. (Demo Code: 849201)`);
    }, 600);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) {
      setErrorMsg('Please enter the full 6-digit code.');
      return;
    }

    if (otp === '000000') {
      setErrorMsg('Expired code. Please click Resend OTP.');
      return;
    }

    if (otp === '999999') {
      setErrorMsg('Invalid code. Please re-check the email OTP.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      if (isNewUser) {
        setStep('PROFILE');
      } else {
        loginWithEmailOtp(email, name, mobile);
      }
    }, 600);
  };

  const handleCompleteProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !mobile) {
      setErrorMsg('Name and mobile number are required.');
      return;
    }
    loginWithEmailOtp(email, name, mobile);
  };

  const handleResend = () => {
    setCountdown(45);
    setOtp('849201');
    addToast('info', 'Code Resent', `New verification OTP sent to ${email}. (Demo Code: 849201)`);
  };

  return (
    <div
      onClick={() => setAuthModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[calc(100vh-2rem)] animate-in zoom-in-95"
      >
        {/* Header - Fixed at top */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-5 sm:p-6 relative shrink-0">
          <button
            onClick={() => setAuthModalOpen(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 text-xs font-semibold mb-2 border border-blue-400/20">
            <Mail className="w-3.5 h-3.5" /> Passwordless Email OTP
          </div>
          <h3 className="text-xl font-bold text-white">
            {step === 'EMAIL' && 'Welcome to GR Sports'}
            {step === 'OTP' && 'Verify Your Email'}
            {step === 'PROFILE' && 'Setup Your Player Profile'}
          </h3>
          <p className="text-xs text-blue-200 mt-1">
            {step === 'EMAIL' && 'Sign in or create an account with a secure one-time code.'}
            {step === 'OTP' && `Enter the 6-digit verification code sent to ${email}.`}
            {step === 'PROFILE' && 'One-time setup for rapid doorstep pickup & delivery.'}
          </p>
        </div>

        {/* Content Body - Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 'EMAIL' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="player@example.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  No passwords required. We'll send a 6-digit code to this email.
                </p>
              </div>

              {/* Simulation switch: New User profile trigger */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-600">Simulate First-Time Customer?</span>
                <input
                  type="checkbox"
                  checked={isNewUser}
                  onChange={(e) => setIsNewUser(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                variant="primary"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Send Login OTP
              </Button>
            </form>
          )}

          {step === 'OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    6-Digit Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('EMAIL');
                      setErrorMsg(null);
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Change Email
                  </button>
                </div>

                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, ''));
                      setErrorMsg(null);
                    }}
                    placeholder="849201"
                    className="w-full pl-10 pr-4 py-3 text-center tracking-widest text-lg font-mono font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500 mt-2">
                  <span>Demo valid code: <b className="text-blue-600 font-mono">849201</b></span>
                  <span>Try invalid: <b className="text-rose-500 font-mono">999999</b></span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500">Didn't receive code?</span>
                <button
                  type="button"
                  onClick={handleResend}
                  className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Resend Code
                </button>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                variant="primary"
                isLoading={isLoading}
              >
                Verify & Continue
              </Button>
            </form>
          )}

          {step === 'PROFILE' && (
            <form onSubmit={handleCompleteProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number (For Delivery Agent Coordination)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Doorstep Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full mt-2"
                size="lg"
                variant="primary"
                isLoading={isLoading}
              >
                Complete Setup & Enter Portal
              </Button>
            </form>
          )}
        </div>

        {/* Security badge footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Encrypted OTP authentication. No SMS spam.</span>
        </div>
      </div>
    </div>
  );
};
