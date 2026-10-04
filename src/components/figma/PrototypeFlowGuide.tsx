import React from 'react';
import { useApp } from '../../context/AppContext';
import { Button } from '../common/Button';
import {
  Sparkles,
  ArrowRight,
  Play,
  CheckCircle2,
  AlertTriangle,
  User,
  Wrench,
  ShieldAlert,
  DollarSign,
  Compass,
} from 'lucide-react';

export const PrototypeFlowGuide: React.FC = () => {
  const {
    setCurrentRole,
    setActiveView,
    setCustomerSubView,
    setEmployeeSubView,
    setAdminSubView,
    setSelectedRequestId,
    setModalTargetRequestId,
    setRepairEstimateModalOpen,
    setRevisedEstimateModalOpen,
    distanceConfig,
  } = useApp();

  const handleTestScenarioB = () => {
    // Revised Estimate Scenario: REP-00025 (400 -> 650)
    setCurrentRole('CUSTOMER');
    setActiveView('customer_portal');
    setSelectedRequestId('REP-00025');
    setCustomerSubView('detail');
    setModalTargetRequestId('REP-00025');
    setRevisedEstimateModalOpen(true);
  };

  const handleTestScenarioA = () => {
    // Initial Estimate Approval: REP-00026 (400)
    setCurrentRole('CUSTOMER');
    setActiveView('customer_portal');
    setSelectedRequestId('REP-00026');
    setCustomerSubView('detail');
    setModalTargetRequestId('REP-00026');
    setRepairEstimateModalOpen(true);
  };

  const handleTestScenarioC = () => {
    // New Booking with Distance Calculation
    setCurrentRole('CUSTOMER');
    setActiveView('customer_portal');
    setCustomerSubView('wizard');
  };

  const handleTestScenarioD = () => {
    // Employee Delivery & Payment
    setCurrentRole('EMPLOYEE');
    setActiveView('employee_portal');
    setEmployeeSubView('deliveries');
  };

  const handleTestScenarioE = () => {
    // Admin 7-Day SLA Monitoring
    setCurrentRole('ADMIN');
    setActiveView('admin_portal');
    setAdminSubView('sla_monitor');
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-10 pb-16">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <span className="text-xs font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
          FIGMA FILE PAGE 15 — PROTOTYPE USER FLOWS
        </span>
        <h1 className="text-3xl font-black text-slate-900 mt-2">
          Interactive Prototype &amp; Test Scenario Launcher
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Directly execute key business workflows across Customer, Employee, and Admin portals.
        </p>
      </div>

      {/* 1-Click Interactive Test Scenarios */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <span>Core Evaluation Scenarios (Instant 1-Click Navigation)</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Scenario B: Revised Repair Estimate Approval (PROMPT EMPHASIS) */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50/60 p-5 rounded-3xl border-2 border-amber-300 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-200 px-2 py-0.5 rounded-full">
                CRITICAL WORKFLOW
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-2">
                Revised Estimate Approval (₹400 → ₹650)
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Experience the exact revised repair scenario: Additional damage identified during repair prep, transparent price revision, and customer approval gate.
              </p>
            </div>
            <Button
              onClick={handleTestScenarioB}
              variant="secondary"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 font-bold"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Launch Revised Modal (REP-00025)
            </Button>
          </div>

          {/* Scenario A: Initial Estimate Approval */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 bg-blue-100 px-2 py-0.5 rounded-full">
                STANDARD REPAIR FLOW
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-2">
                Standard Estimate Ready (₹400)
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Technician completed physical workshop inspection: Labour ₹300, Materials ₹100, Free delivery = Total ₹400.
              </p>
            </div>
            <Button
              onClick={handleTestScenarioA}
              variant="primary"
              size="sm"
              className="font-bold"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Launch Estimate Modal (REP-00026)
            </Button>
          </div>

          {/* Scenario C: 15 KM Free vs Surcharge */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full">
                LOGISTICS RULE
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-2">
                Distance Calculator &amp; {distanceConfig.freeRadiusKm} KM Rule
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Simulate address selection with interactive map: Free within {distanceConfig.freeRadiusKm} KM, transparent slab/per-KM charges beyond {distanceConfig.freeRadiusKm} KM.
              </p>
            </div>
            <Button
              onClick={handleTestScenarioC}
              variant="outline"
              size="sm"
              className="font-bold"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Open Booking Wizard
            </Button>
          </div>

          {/* Scenario D: Post-Delivery Payment Collection */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-900 bg-teal-100 px-2 py-0.5 rounded-full">
                EMPLOYEE PORTAL
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-2">
                Manual Doorstep Payment Recording
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Employee delivers serviced bat and records payment manually via Cash or UPI with instant receipt generation.
              </p>
            </div>
            <Button
              onClick={handleTestScenarioD}
              variant="outline"
              size="sm"
              className="font-bold text-emerald-700 hover:bg-emerald-50"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Go to Employee Deliveries
            </Button>
          </div>

          {/* Scenario E: Admin SLA Monitoring */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-900 bg-rose-100 px-2 py-0.5 rounded-full">
                ADMIN GOVERNANCE
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-2">
                7-Day Repair SLA Monitoring
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Color-coded tracking (Green, Amber, Red) of days elapsed since pickup to guarantee repairs finish within 7 days.
              </p>
            </div>
            <Button
              onClick={handleTestScenarioE}
              variant="outline"
              size="sm"
              className="font-bold text-blue-700 hover:bg-blue-50"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Open Admin SLA Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
