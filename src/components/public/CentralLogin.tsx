import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import {
  Wrench,
  User,
  Shield,
  KeyRound,
  Mail,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
  ArrowLeft,
  Truck,
  Clock,
  Compass,
  AlertCircle,
  HelpCircle,
  Smartphone,
  Eye,
  EyeOff,
  MapPin,
  Phone
} from 'lucide-react';
import { Button } from '../common/Button';
import { GRSportsLogo } from '../common/GRSportsLogo';
import { apiClient } from '../../services/apiClient';
import { authService } from '../../services/authService';

export const CentralLogin: React.FC = () => {
  const {
    loginAsRole,
    setActiveView,
    addToast,
    loginRoleTab,
    setLoginRoleTab,
    distanceConfig,
    pendingWizardLaunch,
    wizardPrefill,
  } = useApp();

  const [activeTab, setActiveTab] = useState<UserRole>(loginRoleTab || 'CUSTOMER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [authMethod, setAuthMethod] = useState<'OTP' | 'PASSWORD'>('OTP');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authStageText, setAuthStageText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Customer Mode: LOGIN vs REGISTER
  const [customerMode, setCustomerMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  React.useEffect(() => {
    if (loginRoleTab) {
      handleTabChange(loginRoleTab);
    }
  }, [loginRoleTab]);

  // Sync default fields when switching tabs
  const handleTabChange = (role: UserRole) => {
    setActiveTab(role);
    setLoginRoleTab(role);
    setErrorMessage(null);
    setEmail('');
    setPassword('');
    setOtp('');
    setOtpSent(false);
    if (role === 'CUSTOMER') {
      setAuthMethod('OTP');
    } else {
      setAuthMethod('PASSWORD');
    }
  };

  const handleFetchLocation = () => {
    if (!navigator.geolocation) {
      addToast('error', 'Location Error', 'Geolocation is not supported by your browser');
      return;
    }
    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsFetchingLocation(false);
        const loc = `GPS Coordinates (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}) - Bengaluru`;
        setRegAddress(loc);
        addToast('success', 'Location Detected', 'Fetched your current GPS location for doorstep delivery!');
      },
      () => {
        setIsFetchingLocation(false);
        addToast('warning', 'Location Warning', 'Unable to detect location. Please type your delivery address.');
      }
    );
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!regName.trim() || !regEmail.trim() || !regPhone.trim()) {
      setErrorMessage('Please provide your name, email address, and mobile number.');
      return;
    }
    setIsAuthenticating(true);
    setAuthStageText('Creating customer account & profile...');

    try {
      try {
        await apiClient.post('/auth/register-customer', {
          name: regName.trim(),
          email: regEmail.trim(),
          phone: regPhone.trim(),
          address: regAddress.trim(),
          password: regPassword || 'player2026'
        });
      } catch (err) {
        console.warn('API customer register fallback', err);
      }
      setTimeout(() => {
        setIsAuthenticating(false);
        loginAsRole('CUSTOMER', regEmail.trim(), regName.trim(), regPhone.trim(), 'Registered Player');
        addToast('success', 'Account Created', `Welcome to GR Sports, ${regName}! Your account is active.`);
      }, 600);
    } catch (err: any) {
      setIsAuthenticating(false);
      setErrorMessage(err.message || 'Registration failed');
    }
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    setErrorMessage(null);
  };

  const handleRequestOtp = async () => {
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address first.');
      return;
    }
    setIsSendingOtp(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.post<any>('/auth/otp/request', { identifier: email.trim() });
      setIsSendingOtp(false);
      setOtpSent(true);
      setOtp('');
      if (res.smtpSent === false) {
        addToast(
          'warning',
          'Sandbox Email Notice',
          `Resend free tier only delivers to registered owner (dmeeravali191@gmail.com). Sandbox OTP: ${res.otp || 'Available in console'}`
        );
      } else {
        addToast('success', 'Verification Code Sent', res.message || `Verification code sent to ${email}`);
      }
    } catch (err: any) {
      setIsSendingOtp(false);
      setErrorMessage(err.message || 'Failed to dispatch verification email.');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (activeTab === 'CUSTOMER' && authMethod === 'OTP') {
      if (!otpSent) {
        await handleRequestOtp();
        return;
      }
      if (!otp || otp.length < 6) {
        setErrorMessage('Please enter the 6-digit verification code.');
        return;
      }
    } else {
      if (!password) {
        setErrorMessage('Please enter your password.');
        return;
      }
    }

    setIsAuthenticating(true);
    setAuthStageText(`Verifying credentials with GR Sports security...`);

    try {
      const session = await authService.login(
        activeTab === 'CUSTOMER' && authMethod === 'OTP'
          ? { email: email.trim(), otp: otp.trim(), role: 'CUSTOMER' }
          : { email: email.trim(), password: password.trim(), role: activeTab }
      );
      setIsAuthenticating(false);
      loginAsRole(session.role, session.email, session.name, session.mobile, session.title);
      addToast('success', 'Authentication Successful', `Welcome back, ${session.name}!`);
    } catch (err: any) {
      setIsAuthenticating(false);
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-900 text-slate-100 flex flex-col justify-between py-8 px-4 sm:px-6 relative overflow-hidden">
      {/* Background Sport Aura Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between mb-6 relative z-10">
        <button
          onClick={() => setActiveView('landing')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Public Website</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>256-Bit TLS Secured Authentication</span>
        </div>
      </div>

      {/* Main Central Card Container */}
      <div className="max-w-4xl mx-auto w-full relative z-10 space-y-8">
        {/* Title Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-1">
            <GRSportsLogo size="lg" theme="dark" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>CENTRALIZED ECOSYSTEM GATEWAY</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Single Sign-On Authentication
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Log in with your credentials to automatically access your designated portal — Player Services, Operations &amp; Workshop, or Master Administration.
          </p>
        </div>

        {/* Booking in Progress Notification Banner */}
        {pendingWizardLaunch && (
          <div className="bg-gradient-to-r from-blue-900/90 via-slate-900/90 to-blue-950/90 border-2 border-blue-500/50 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 shrink-0">
                <Sparkles className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block">
                  DOORSTEP BOOKING IN PROGRESS
                </span>
                <p className="text-xs font-bold text-white">
                  Sign in or create your player account to confirm your {wizardPrefill?.serviceType === 'REPAIR' ? 'Racquet Repair' : 'Bat Getting'} booking.
                </p>
                {wizardPrefill?.batBrand && (
                  <p className="text-[11px] text-blue-300 mt-0.5">
                    Selected: {wizardPrefill.batBrand} {wizardPrefill.batModel} {wizardPrefill.stringType ? `• ${wizardPrefill.stringType} @ ${wizardPrefill.stringTension} lbs` : ''}
                  </p>
                )}
              </div>
            </div>
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg shrink-0 hidden sm:inline-block">
              Zero Advance Required
            </span>
          </div>
        )}

        {/* Central Login Card */}
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden">
          {/* Persona Selection Tabs */}
          <div className="grid grid-cols-3 border-b border-slate-700/80 bg-slate-850/60 p-2 gap-1.5 text-xs font-bold">
            <button
              onClick={() => handleTabChange('CUSTOMER')}
              type="button"
              className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-3 px-2 rounded-2xl transition-all ${
                activeTab === 'CUSTOMER'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <div className="text-center sm:text-left">
                <span className="block leading-tight">Player / Customer</span>
                <span className="text-[10px] opacity-75 hidden sm:block font-normal">Racquet Services</span>
              </div>
            </button>

            <button
              onClick={() => handleTabChange('EMPLOYEE')}
              type="button"
              className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-3 px-2 rounded-2xl transition-all ${
                activeTab === 'EMPLOYEE'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Wrench className="w-4 h-4 shrink-0" />
              <div className="text-center sm:text-left">
                <span className="block leading-tight">Employee</span>
                <span className="text-[10px] opacity-75 hidden sm:block font-normal">Service &amp; Delivery</span>
              </div>
            </button>

            <button
              onClick={() => handleTabChange('ADMIN')}
              type="button"
              className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-3 px-2 rounded-2xl transition-all ${
                activeTab === 'ADMIN'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <div className="text-center sm:text-left">
                <span className="block leading-tight">Master Admin</span>
                <span className="text-[10px] opacity-75 hidden sm:block font-normal">Console &amp; SLA Hub</span>
              </div>
            </button>
          </div>

          {/* Form & Persona Info Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 p-6 sm:p-8 gap-8 items-center">
            {/* Left: Login Form (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Context Banner */}
              <div className={`p-4 rounded-2xl border text-xs ${
                activeTab === 'CUSTOMER'
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                  : activeTab === 'EMPLOYEE'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-purple-500/10 border-purple-500/30 text-purple-200'
              }`}>
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Target Destination: {
                    activeTab === 'CUSTOMER'
                      ? 'Customer Portal (Dashboard, Booking, Live Tracker)'
                      : activeTab === 'EMPLOYEE'
                      ? 'Employee Operations Portal (Pickup Run, Stringing & Repairs)'
                      : 'Master Admin Console (KPIs, SLA Monitor, Distance Config)'
                  }
                </p>
                <p className="text-[11px] opacity-80 mt-1">
                  {activeTab === 'CUSTOMER' && 'Manage your badminton bat getting & composite repairs with doorstep pickup.'}
                  {activeTab === 'EMPLOYEE' && 'Conduct doorstep condition assessments, tension stringing and collect payments.'}
                  {activeTab === 'ADMIN' && 'Real-time financial reconciliation, 7-day SLA tracking, and audit logging.'}
                </p>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Authenticating Loading State */}
              {isAuthenticating ? (
                <div className="p-8 text-center space-y-4 bg-slate-900/60 rounded-2xl border border-slate-700/80">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="font-bold text-white text-sm">{authStageText}</p>
                  <p className="text-xs text-slate-400">Securely routing your session...</p>
                </div>
              ) : activeTab === 'CUSTOMER' && customerMode === 'REGISTER' ? (
                /* NEW CUSTOMER REGISTRATION FORM */
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div className="flex rounded-xl bg-slate-900/90 p-1 border border-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setCustomerMode('LOGIN')}
                      className="flex-1 py-2 rounded-lg font-medium text-slate-400 hover:text-white transition-all"
                    >
                      Existing Customer Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerMode('REGISTER')}
                      className="flex-1 py-2 rounded-lg font-bold bg-emerald-600 text-white shadow transition-all"
                    >
                      ✍️ New Customer Register
                    </button>
                  </div>

                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">Full Name *</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Enter your full name"
                        required
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Mobile Number */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">Mobile Phone Number *</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        required
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">Email Address *</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="yourname@gmail.com"
                        required
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Doorstep Delivery Address & GPS fetch */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                      <span>Doorstep Pickup &amp; Delivery Address</span>
                      <button
                        type="button"
                        onClick={handleFetchLocation}
                        disabled={isFetchingLocation}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                      >
                        <MapPin className="w-3 h-3" />
                        {isFetchingLocation ? 'Fetching GPS...' : 'Use Current GPS Location'}
                      </button>
                    </div>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                      <textarea
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                        placeholder="House / Flat / Street address in Bengaluru"
                        rows={2}
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">Create Account Password (Optional)</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Choose a password or 4-digit PIN"
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Submit Registration */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full font-bold shadow-xl !bg-emerald-600 hover:!bg-emerald-500 !text-white transition-all mt-2"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Create Account &amp; Enter Customer Portal
                  </Button>
                </form>
              ) : (
                /* REGULAR LOGIN FORM */
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {/* Mode switcher for Customer */}
                  {activeTab === 'CUSTOMER' && (
                    <div className="flex rounded-xl bg-slate-900/90 p-1 border border-slate-700 text-xs">
                      <button
                        type="button"
                        onClick={() => setCustomerMode('LOGIN')}
                        className="flex-1 py-2 rounded-lg font-bold bg-blue-600 text-white shadow transition-all"
                      >
                        Existing Customer Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerMode('REGISTER')}
                        className="flex-1 py-2 rounded-lg font-medium text-slate-400 hover:text-white transition-all"
                      >
                        ✍️ New Customer? Register
                      </button>
                    </div>
                  )}

                  {/* Email / Username Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span>{activeTab === 'CUSTOMER' ? 'Email Address' : 'Official Staff / Admin Email'}</span>
                      <span className="text-[11px] font-normal text-slate-500">Auto-detects role</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        placeholder={
                          activeTab === 'CUSTOMER'
                            ? 'Enter your email address'
                            : activeTab === 'EMPLOYEE'
                            ? 'Enter employee email (e.g. employee@grsports.com)'
                            : 'Enter admin email (e.g. admin@grsports.com)'
                        }
                        required
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Customer Auth Method Switcher (OTP vs Password) */}
                  {activeTab === 'CUSTOMER' && (
                    <div className="flex items-center gap-2 p-1 bg-slate-900 rounded-xl text-xs font-medium border border-slate-700">
                      <button
                        type="button"
                        onClick={() => setAuthMethod('OTP')}
                        className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                          authMethod === 'OTP' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Email OTP Code
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMethod('PASSWORD')}
                        className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                          authMethod === 'PASSWORD' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Account Password
                      </button>
                    </div>
                  )}

                  {/* OTP Input for Customer */}
                  {activeTab === 'CUSTOMER' && authMethod === 'OTP' ? (
                    <div className="space-y-3">
                      {!otpSent ? (
                        <div className="space-y-3 pt-1">
                          <p className="text-xs text-slate-400">
                            We will send a secure 6-digit verification code to <span className="text-blue-300 font-semibold">{email || 'your email'}</span>.
                          </p>
                          <Button
                            type="button"
                            onClick={handleRequestOtp}
                            isLoading={isSendingOtp}
                            variant="primary"
                            className="w-full font-bold shadow-lg"
                            rightIcon={<Mail className="w-4 h-4" />}
                          >
                            Send Verification OTP
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                            <span>6-Digit Verification Code</span>
                            <button
                              type="button"
                              onClick={handleRequestOtp}
                              className="text-[11px] text-blue-400 hover:underline font-normal"
                            >
                              Resend OTP
                            </button>
                          </div>
                          <div className="relative">
                            <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                              type="text"
                              maxLength={6}
                              value={otp}
                              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                              placeholder="Enter 6-digit code from email"
                              required
                              className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white font-mono tracking-widest text-center placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                          </div>
                          <div className="flex justify-between items-center text-[11px] text-slate-400">
                            <span>Code sent to {email}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setOtpSent(false);
                                setOtp('');
                              }}
                              className="text-slate-400 hover:text-white underline"
                            >
                              Change Email
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Password Input */
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                        <span>{activeTab === 'ADMIN' ? 'Admin Master Passkey' : 'Security Password'}</span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {activeTab === 'ADMIN' ? 'Admin PIN' : activeTab === 'EMPLOYEE' ? 'Staff PIN' : 'Password'}
                        </span>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your security password"
                          required
                          className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  {!(activeTab === 'CUSTOMER' && authMethod === 'OTP' && !otpSent) && (
                    <Button
                      type="submit"
                      variant={activeTab === 'CUSTOMER' ? 'primary' : activeTab === 'EMPLOYEE' ? 'secondary' : 'primary'}
                      size="lg"
                      isLoading={isAuthenticating}
                      className={`w-full font-bold shadow-xl transition-all ${
                        activeTab === 'ADMIN' ? '!bg-purple-600 hover:!bg-purple-500 !text-white' : ''
                      }`}
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      {activeTab === 'CUSTOMER' && authMethod === 'OTP'
                        ? 'Verify Code & Enter Customer Portal'
                        : `Authenticate & Enter ${activeTab === 'CUSTOMER' ? 'Customer Portal' : activeTab === 'EMPLOYEE' ? 'Operations Portal' : 'Admin Console'}`}
                    </Button>
                  )}
                </form>
              )}
            </div>

            {/* Right: Persona Specification & Quick Access (5 Cols) */}
            <div className="lg:col-span-5 bg-slate-900/70 p-6 rounded-2xl border border-slate-700/60 space-y-5">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Role Privileges &amp; Scope
                </span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {activeTab === 'CUSTOMER' && <><User className="w-4 h-4 text-blue-400" /> Customer Persona</>}
                  {activeTab === 'EMPLOYEE' && <><Wrench className="w-4 h-4 text-emerald-400" /> Employee Persona</>}
                  {activeTab === 'ADMIN' && <><Shield className="w-4 h-4 text-purple-400" /> System Admin Persona</>}
                </h3>
              </div>

              {/* Bullet Features */}
              <div className="space-y-2.5 text-xs text-slate-300">
                {activeTab === 'CUSTOMER' && (
                  <>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>Book bat stringing (20–32 lbs) &amp; repair services</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>Live 10–12 stage racket timeline tracking</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>Approve workshop repair estimates &amp; price revisions</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>{distanceConfig.freeRadiusKm} KM free doorstep pickup &amp; delivery</span>
                    </div>
                  </>
                )}

                {activeTab === 'EMPLOYEE' && (
                  <>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Doorstep pickup tasks with bat condition logging</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Stringing queue with electronic constant-pull tracking</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Workshop physical inspection &amp; price revision requests</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>In-person Cash or UPI payment collection logging</span>
                    </div>
                  </>
                )}

                {activeTab === 'ADMIN' && (
                  <>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <span>Financial overview, collections, and dues register</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <span>7-Day Repair SLA monitoring &amp; breach alerts</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <span>{distanceConfig.freeRadiusKm} KM radius rules &amp; distance surcharge slabs</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <span>15 transactional email notification templates</span>
                    </div>
                  </>
                )}
              </div>

              {/* Real World Scenario Note */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-400 leading-relaxed">
                <span className="font-bold text-slate-200">Real-World Behavior:</span> In production, credentials verify the user's role on the backend and navigate strictly to their authorized portal. A Customer cannot access Staff or Admin portals.
              </div>
            </div>
          </div>
        </div>

        {/* Credentials & Access Guidance */}
        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong className="text-white">Secure Multi-Persona Gateway:</strong> Customers authenticate via 6-digit OTP dispatched to their email or password. Staff & Admins authenticate using their assigned portal email and password.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveTab('CUSTOMER');
              setCustomerMode('REGISTER');
            }}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold whitespace-nowrap"
          >
            New Customer? Register here →
          </button>
        </div>
      </div>

      {/* Footer Note */}
      <div className="max-w-4xl mx-auto w-full text-center text-[11px] text-slate-500 pt-6">
        GR Sports Badminton Stringing &amp; Repair Platform • Phase 1 Doorstep Payment System (Cash / UPI) • Indiranagar Hub, Bengaluru
      </div>
    </div>
  );
};
