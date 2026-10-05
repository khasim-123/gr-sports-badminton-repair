import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Mail,
  KeyRound,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  User,
  Phone,
  MapPin,
  Wrench,
  Shield,
  Lock,
  Zap,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '../common/Button';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    setAuthModalOpen,
    authModalRole,
    setAuthModalRole,
    loginWithEmailOtp,
    loginAsRole,
    addToast
  } = useApp();

  // Customer State
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

  // Staff / Admin Password State
  const [staffEmail, setStaffEmail] = useState('employee@grsports.com');
  const [staffPassword, setStaffPassword] = useState('ops2026');
  const [adminEmail, setAdminEmail] = useState('admin@grsports.com');
  const [adminPassword, setAdminPassword] = useState('admin2026');
  const [showPassword, setShowPassword] = useState(false);

  // Sync default credentials if role changes
  React.useEffect(() => {
    setErrorMsg(null);
    if (authModalRole === 'EMPLOYEE') {
      setStaffEmail('employee@grsports.com');
      setStaffPassword('ops2026');
    } else if (authModalRole === 'ADMIN') {
      setAdminEmail('admin@grsports.com');
      setAdminPassword('admin2026');
    }
  }, [authModalRole]);

  if (!authModalOpen) return null;

  // CUSTOMER HANDLERS
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
    }, 500);
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
    }, 500);
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

  const handleOneClickCustomerLogin = () => {
    loginWithEmailOtp('vikram.m@example.com', 'Vikram Malhotra', '+91 99887 76655');
  };

  // EMPLOYEE / STAFF HANDLER
  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEmail || !staffEmail.includes('@')) {
      setErrorMsg('Please enter a valid staff email.');
      return;
    }
    if (!staffPassword) {
      setErrorMsg('Please enter your staff password.');
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      loginAsRole('EMPLOYEE', staffEmail, 'Rahul Sharma', '+91 98765 43210', 'Field Operations & Workshop Technician');
    }, 500);
  };

  // ADMIN HANDLER
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminEmail.includes('@')) {
      setErrorMsg('Please enter a valid administrator email.');
      return;
    }
    if (!adminPassword) {
      setErrorMsg('Please enter your administrator password.');
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      loginAsRole('ADMIN', adminEmail, 'Store Administrator', '+91 98888 11223', 'Store Management Administrator');
    }, 500);
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
        {/* ================= HEADER (ROLE AWARE) ================= */}
        {authModalRole === 'CUSTOMER' && (
          <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-5 sm:p-6 relative shrink-0">
            <button
              onClick={() => setAuthModalOpen(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 text-xs font-semibold mb-2 border border-blue-400/20">
              <User className="w-3.5 h-3.5" /> Player &amp; Customer Access
            </div>
            <h3 className="text-xl font-bold text-white">
              {step === 'EMAIL' && 'Customer Sign In'}
              {step === 'OTP' && 'Verify Your Email'}
              {step === 'PROFILE' && 'Setup Your Player Profile'}
            </h3>
            <p className="text-xs text-blue-200 mt-1">
              {step === 'EMAIL' && 'Sign in to book racquet stringing, track repairs, and manage orders.'}
              {step === 'OTP' && `Enter the 6-digit verification code sent to ${email}.`}
              {step === 'PROFILE' && 'One-time setup for rapid doorstep pickup & delivery.'}
            </p>
          </div>
        )}

        {authModalRole === 'EMPLOYEE' && (
          <div className="bg-gradient-to-r from-emerald-950 via-emerald-800 to-teal-900 text-white p-5 sm:p-6 relative shrink-0">
            <button
              onClick={() => setAuthModalOpen(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 text-xs font-semibold mb-2 border border-emerald-400/20">
              <Wrench className="w-3.5 h-3.5" /> Staff &amp; Workshop Ops
            </div>
            <h3 className="text-xl font-bold text-white">
              Employee Operations Sign In
            </h3>
            <p className="text-xs text-emerald-200 mt-1">
              Access doorstep pickup tasks, constant-pull queue, and repair inspection.
            </p>
          </div>
        )}

        {authModalRole === 'ADMIN' && (
          <div className="bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 text-white p-5 sm:p-6 relative shrink-0">
            <button
              onClick={() => setAuthModalOpen(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-200 text-xs font-semibold mb-2 border border-purple-400/20">
              <Shield className="w-3.5 h-3.5" /> Management &amp; Security
            </div>
            <h3 className="text-xl font-bold text-white">
              Admin Console Sign In
            </h3>
            <p className="text-xs text-purple-200 mt-1">
              Store analytics, financial reconciliations, 7-day SLA tracker, and pricing rules.
            </p>
          </div>
        )}

        {/* ================= BODY CONTENT ================= */}
        <div className="p-5 sm:p-6 overflow-y-auto">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. CUSTOMER LOGIN BODY (100% CUSTOMER ONLY) */}
          {authModalRole === 'CUSTOMER' && (
            <>
              {step === 'EMAIL' && (
                <div className="space-y-4">
                  {/* Quick 1-Click Demo Button */}
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-blue-900 block flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-blue-600" /> Fast Customer Login
                      </span>
                      <span className="text-[11px] text-blue-700">Vikram Malhotra (Player)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleOneClickCustomerLogin}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all"
                    >
                      Sign In Now →
                    </button>
                  </div>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-semibold uppercase">Or with email code</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

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
                        Passwordless login. We'll send a 6-digit OTP to this email.
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
                      Send Verification OTP
                    </Button>
                  </form>
                </div>
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
                      <span>Demo code: <b className="text-blue-600 font-mono">849201</b></span>
                      <span>Invalid test: <b className="text-rose-500 font-mono">999999</b></span>
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
                    Verify &amp; Enter Portal
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
                      Mobile Number (For Delivery Coordination)
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
                    Complete Setup &amp; Enter Portal
                  </Button>
                </form>
              )}
            </>
          )}

          {/* 2. EMPLOYEE / STAFF LOGIN BODY */}
          {authModalRole === 'EMPLOYEE' && (
            <div className="space-y-4">
              {/* Quick 1-Click Staff Demo */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-emerald-900 block flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-emerald-600" /> Fast Staff Login
                  </span>
                  <span className="text-[11px] text-emerald-700">Rahul Sharma (Master Stringer)</span>
                </div>
                <button
                  type="button"
                  onClick={() => loginAsRole('EMPLOYEE', 'employee@grsports.com', 'Rahul Sharma', '+91 98765 43210', 'Master Stringer & Field Ops')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
                >
                  Sign In Now →
                </button>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-semibold uppercase">Or enter credentials</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <form onSubmit={handleStaffLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Employee Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Staff Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Default demo password: <code className="text-emerald-700 font-bold">ops2026</code></p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2"
                  size="lg"
                  variant="primary"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Access Operations Portal
                </Button>
              </form>

              <div className="pt-2 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAuthModalRole('ADMIN')}
                  className="text-xs text-purple-700 hover:text-purple-800 font-semibold"
                >
                  Store Administrator? Switch to Admin Console Login →
                </button>
              </div>
            </div>
          )}

          {/* 3. ADMIN LOGIN BODY */}
          {authModalRole === 'ADMIN' && (
            <div className="space-y-4">
              {/* Quick 1-Click Admin Demo */}
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-purple-900 block flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-purple-600" /> Fast Admin Login
                  </span>
                  <span className="text-[11px] text-purple-700">GR Sports Store Administrator</span>
                </div>
                <button
                  type="button"
                  onClick={() => loginAsRole('ADMIN', 'admin@grsports.com', 'Store Administrator', '+91 98888 11223', 'Management & Shop Administrator')}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition-all"
                >
                  Sign In Now →
                </button>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-semibold uppercase">Or enter credentials</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Administrator Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Administrator Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Default demo password: <code className="text-purple-700 font-bold">admin2026</code></p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 mt-2"
                  size="lg"
                  variant="primary"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Access Admin Console
                </Button>
              </form>

              <div className="pt-2 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAuthModalRole('EMPLOYEE')}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
                >
                  Field Technician? Switch to Staff Login →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Security badge footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>GR Sports Secure Gateway • 256-Bit SSL Encrypted</span>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
