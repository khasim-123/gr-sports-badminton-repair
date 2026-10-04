import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Layers, ChevronUp, ChevronDown, CheckCircle2, ArrowRight } from 'lucide-react';

interface FigmaPage {
  num: string;
  name: string;
  action: () => void;
}

export const FigmaNavigator: React.FC = () => {
  const {
    loginAsRole,
    setCurrentRole,
    setActiveView,
    setCustomerSubView,
    setEmployeeSubView,
    setAdminSubView,
    setAuthModalOpen,
    setDeviceViewport,
    setSelectedRequestId,
    setModalTargetRequestId,
    setRevisedEstimateModalOpen,
    setRepairEstimateModalOpen,
  } = useApp();

  const [expanded, setExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState('01 — Cover & Product Overview');

  const figmaPages: FigmaPage[] = [
    {
      num: '01',
      name: 'Cover & Product Overview',
      action: () => {
        setActiveView('landing');
      },
    },
    {
      num: '02',
      name: 'Design System',
      action: () => {
        setActiveView('figma_system');
      },
    },
    {
      num: '03',
      name: 'Components',
      action: () => {
        setActiveView('figma_system');
      },
    },
    {
      num: '04',
      name: 'Public Website',
      action: () => {
        setActiveView('landing');
      },
    },
    {
      num: '05',
      name: 'Customer Authentication',
      action: () => {
        setActiveView('login');
      },
    },
    {
      num: '06',
      name: 'Customer Portal',
      action: () => {
        loginAsRole('CUSTOMER');
        setCustomerSubView('dashboard');
      },
    },
    {
      num: '07',
      name: 'Getting Service Flow',
      action: () => {
        loginAsRole('CUSTOMER');
        setCustomerSubView('wizard');
      },
    },
    {
      num: '08',
      name: 'Repair Service Flow',
      action: () => {
        loginAsRole('CUSTOMER');
        setSelectedRequestId('REP-00025');
        setCustomerSubView('detail');
        setModalTargetRequestId('REP-00025');
        setRevisedEstimateModalOpen(true);
      },
    },
    {
      num: '09',
      name: 'Employee Portal',
      action: () => {
        loginAsRole('EMPLOYEE');
        setEmployeeSubView('dashboard');
      },
    },
    {
      num: '10',
      name: 'Admin Portal',
      action: () => {
        loginAsRole('ADMIN');
        setAdminSubView('dashboard');
      },
    },
    {
      num: '11',
      name: 'Reports & Analytics',
      action: () => {
        loginAsRole('ADMIN');
        setAdminSubView('reports');
      },
    },
    {
      num: '12',
      name: 'Notifications & Templates',
      action: () => {
        loginAsRole('ADMIN');
        setAdminSubView('templates');
      },
    },
    {
      num: '13',
      name: 'Settings & Distance Rules',
      action: () => {
        loginAsRole('ADMIN');
        setAdminSubView('distance');
      },
    },
    {
      num: '14',
      name: 'Mobile Responsive (390px Viewport)',
      action: () => {
        setDeviceViewport('mobile');
      },
    },
    {
      num: '15',
      name: 'Prototype User Flows',
      action: () => {
        setActiveView('figma_flows');
      },
    },
    {
      num: '16',
      name: 'Future Phase 2 Placeholder',
      action: () => {
        setActiveView('phase2');
      },
    },
  ];

  const handleSelectPage = (page: FigmaPage) => {
    setCurrentPage(`${page.num} — ${page.name}`);
    page.action();
    setExpanded(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-700 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 max-w-xs sm:max-w-md">
        {/* Toggle Bar */}
        <div
          onClick={() => setExpanded(!expanded)}
          className="px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/60 select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Figma File Page Index (16 Pages)
              </span>
              <p className="text-xs font-bold text-white truncate">{currentPage}</p>
            </div>
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </div>

        {/* Expanded 16-page drawer */}
        {expanded && (
          <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-800/80 border-t border-slate-800 text-xs">
            {figmaPages.map((p) => (
              <button
                key={p.num}
                onClick={() => handleSelectPage(p)}
                className="w-full text-left py-2 px-3 rounded-xl hover:bg-blue-600/30 flex items-center justify-between gap-2 transition-colors group"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono font-bold text-blue-400 text-[11px] shrink-0">
                    {p.num}
                  </span>
                  <span className="truncate text-slate-200 group-hover:text-white font-medium">
                    {p.name}
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
