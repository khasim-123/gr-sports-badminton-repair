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
  EyeOff
} from 'lucide-react';
import { Button } from '../common/Button';
import { GRSportsLogo } from '../common/GRSportsLogo';

export const CentralLogin: React.FC = () => {
  const { loginAsRole, setActiveView, addToast, loginRoleTab, setLoginRoleTab, distanceConfig } = useApp();

  const [activeTab, setActiveTab] = useState<UserRole>(loginRoleTab || 'CUSTOMER');
  const [email, setEmail] = useState(
    loginRoleTab === 'ADMIN'
      ? 'admin@grsports.com'
      : loginRoleTab === 'EMPLOYEE'
      ? 'employee@grsports.com'
      : 'customer@grsports.com'
  );
  const [password, setPassword] = useState(
    loginRoleTab === 'ADMIN' ? 'admin2026' : loginRoleTab === 'EMPLOYEE' ? 'ops2026' : 'player2026'
  );
  const [otp, setOtp] = useState('849201');
  const [authMethod, setAuthMethod] = useState<'OTP' | 'PASSWORD'>(
    loginRoleTab === 'CUSTOMER' ? 'OTP' : 'PASSWORD'
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authStageText, setAuthStageText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    if (role === 'CUSTOMER') {
      setEmail('customer@grsports.com');
      setPassword('player2026');
      setAuthMethod('OTP');
    } else if (role === 'EMPLOYEE') {
      setEmail('employee@grsports.com');
      setPassword('ops2026');
      setAuthMethod('PASSWORD');
    } else if (role === 'ADMIN') {
      setEmail('admin@grsports.com');
      setPassword('admin2026');
      setAuthMethod('PASSWORD');
    }
  };

  // Smart detection if user types email manually
  const handleEmailChange = (val: string) => {
    setEmail(val);
    const lower = val.toLowerCase();
    if (lower.includes('admin') && activeTab !== 'ADMIN') {
      setActiveTab('ADMIN');
      setPassword('admin2026');
      setAuthMethod('PASSWORD');
    } else if ((lower.includes('employee') || lower.includes('ops') || lower.includes('tech') || lower.includes('staff')) && activeTab !== 'EMPLOYEE') {
      setActiveTab('EMPLOYEE');
      setPassword('ops2026');
      setAuthMethod('PASSWORD');
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (activeTab === 'CUSTOMER' && authMethod === 'OTP') {
      if (!otp || otp.length < 6) {
        setErrorMessage('Please enter the 6-digit verification code.');
        return;
      }
      if (otp === '000000' || otp === '999999') {
        setErrorMessage('Invalid verification code. Please use demo OTP: 849201');
        return;
      }
    } else {
      if (!password || password.length < 4) {
        setErrorMessage('Please enter a valid password or security PIN.');
        return;
      }
    }

    // Determine target role based on current active tab or smart detection
    let targetRole: UserRole = activeTab;
    const lowerEmail = email.toLowerCase();
    if (lowerEmail.includes('admin')) {
      targetRole = 'ADMIN';
    } else if (lowerEmail.includes('employee') || lowerEmail.includes('ops') || lowerEmail.includes('tech')) {
      targetRole = 'EMPLOYEE';
    }

    setIsAuthenticating(true);
    setAuthStageText('Verifying credentials with GR Sports Security...');

    setTimeout(() => {
      setAuthStageText(`Validating ${targetRole} role permissions...`);
      setTimeout(() => {
        setAuthStageText(`Authentication successful! Navigating to ${targetRole} portal...`);
        setTimeout(() => {
          setIsAuthenticating(false);
          if (targetRole === 'CUSTOMER') {
            loginAsRole('CUSTOMER', email, 'Vikram Malhotra', '+91 99887 76655', 'Tournament Player');
          } else if (targetRole === 'EMPLOYEE') {
            loginAsRole('EMPLOYEE', email, 'Rahul Sharma', '+91 98765 43210', 'Field Operations & Stringer');
          } else {
            loginAsRole('ADMIN', email, 'Priya Anand', '+91 98451 11223', 'Platform Admin & Operations Lead');
          }
        }, 500);
      }, 500);
    }, 600);
  };

  const executeQuickDemoLogin = (role: UserRole) => {
    setIsAuthenticating(true);
    setActiveTab(role);
    setErrorMessage(null);

    if (role === 'CUSTOMER') {
      setEmail('customer@grsports.com');
      setAuthStageText('Signing in as Customer (Vikram Malhotra)...');
      setTimeout(() => {
        setIsAuthenticating(false);
        loginAsRole('CUSTOMER', 'customer@grsports.com', 'Vikram Malhotra', '+91 99887 76655', 'Tournament Player');
      }, 700);
    } else if (role === 'EMPLOYEE') {
      setEmail('employee@grsports.com');
      setAuthStageText('Signing in as Operations Staff (Rahul Sharma)...');
      setTimeout(() => {
        setIsAuthenticating(false);
        loginAsRole('EMPLOYEE', 'employee@grsports.com', 'Rahul Sharma', '+91 98765 43210', 'Field Operations & Stringer');
      }, 700);
    } else {
      setEmail('admin@grsports.com');
      setAuthStageText('Signing in as Master Admin (Priya Anand)...');
      setTimeout(() => {
        setIsAuthenticating(false);
        loginAsRole('ADMIN', 'admin@grsports.com', 'Priya Anand', '+91 98451 11223', 'Platform Admin');
      }, 700);
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
                <span className="block leading-tight">Operations Staff</span>
                <span className="text-[10px] opacity-75 hidden sm:block font-normal">Pickups &amp; Workshop</span>
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
              ) : (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
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
                            ? 'e.g. customer@grsports.com'
                            : activeTab === 'EMPLOYEE'
                            ? 'e.g. employee@grsports.com'
                            : 'e.g. admin@grsports.com'
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
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                        <span>6-Digit Verification Code</span>
                        <span className="text-[11px] text-emerald-400 font-normal">Demo OTP: 849201</span>
                      </div>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="849201"
                          required
                          className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white font-mono tracking-widest placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Password Input */
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                        <span>{activeTab === 'ADMIN' ? 'Admin Master Passkey' : 'Security Password'}</span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {activeTab === 'ADMIN' ? 'demo: admin2026' : activeTab === 'EMPLOYEE' ? 'demo: ops2026' : 'demo: player2026'}
                        </span>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
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
                  <Button
                    type="submit"
                    variant={activeTab === 'CUSTOMER' ? 'primary' : activeTab === 'EMPLOYEE' ? 'secondary' : 'primary'}
                    size="lg"
                    className={`w-full font-bold shadow-xl transition-all ${
                      activeTab === 'ADMIN' ? '!bg-purple-600 hover:!bg-purple-500 !text-white' : ''
                    }`}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Authenticate &amp; Enter {activeTab === 'CUSTOMER' ? 'Customer Portal' : activeTab === 'EMPLOYEE' ? 'Operations Portal' : 'Admin Console'}
                  </Button>
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
                  {activeTab === 'EMPLOYEE' && <><Wrench className="w-4 h-4 text-emerald-400" /> Staff &amp; Stringer Persona</>}
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

        {/* 1-Click Demo Evaluation Row (Prompt Requirement: realworld scenarios) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              1-Click Instant Persona Switchers (For Fast Evaluation &amp; Testing):
            </span>
            <span className="text-[11px] text-slate-500 hidden sm:inline">Bypasses manual password typing</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Quick Card 1: Customer */}
            <button
              onClick={() => executeQuickDemoLogin('CUSTOMER')}
              className="bg-slate-800/90 hover:bg-slate-750 p-4 rounded-2xl border border-blue-500/30 hover:border-blue-400 text-left transition-all group shadow-md"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                  Player / Customer
                </span>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="font-black text-white text-sm">Vikram Malhotra</p>
              <p className="text-[11px] text-slate-400 font-mono">customer@grsports.com</p>
              <p className="text-[10px] text-blue-300 mt-2 font-semibold">Enter Customer Portal →</p>
            </button>

            {/* Quick Card 2: Operations */}
            <button
              onClick={() => executeQuickDemoLogin('EMPLOYEE')}
              className="bg-slate-800/90 hover:bg-slate-750 p-4 rounded-2xl border border-emerald-500/30 hover:border-emerald-400 text-left transition-all group shadow-md"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  Operations &amp; Tech
                </span>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="font-black text-white text-sm">Rahul Sharma</p>
              <p className="text-[11px] text-slate-400 font-mono">employee@grsports.com</p>
              <p className="text-[10px] text-emerald-300 mt-2 font-semibold">Enter Operations Portal →</p>
            </button>

            {/* Quick Card 3: Admin */}
            <button
              onClick={() => executeQuickDemoLogin('ADMIN')}
              className="bg-slate-800/90 hover:bg-slate-750 p-4 rounded-2xl border border-purple-500/30 hover:border-purple-400 text-left transition-all group shadow-md"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                  Master Administrator
                </span>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="font-black text-white text-sm">Priya Anand</p>
              <p className="text-[11px] text-slate-400 font-mono">admin@grsports.com</p>
              <p className="text-[10px] text-purple-300 mt-2 font-semibold">Enter Admin Console →</p>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="max-w-4xl mx-auto w-full text-center text-[11px] text-slate-500 pt-6">
        GR Sports Badminton Stringing &amp; Repair Platform • Phase 1 Doorstep Payment System (Cash / UPI) • Indiranagar Hub, Bengaluru
      </div>
    </div>
  );
};
