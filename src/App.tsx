import React from 'react';
import { useApp } from './context/AppContext';
import { Navbar } from './components/common/Navbar';
import { DeviceFrame } from './components/common/DeviceFrame';
import { ToastContainer } from './components/common/ToastContainer';
import { AuthModal } from './components/public/AuthModal';
import { QrMarketingModal } from './components/common/QrMarketingModal';
import { RepairEstimateModal } from './components/customer/RepairEstimateModal';
import { RevisedEstimateModal } from './components/customer/RevisedEstimateModal';
import { Footer } from './components/common/Footer';

// Views
import { LandingPage } from './components/public/LandingPage';
import { CentralLogin } from './components/public/CentralLogin';
import { CustomerPortal } from './components/customer/CustomerPortal';
import { EmployeePortal } from './components/employee/EmployeePortal';
import { AdminPortal } from './components/admin/AdminPortal';
import { DesignSystemShowcase } from './components/figma/DesignSystemShowcase';
import { PrototypeFlowGuide } from './components/figma/PrototypeFlowGuide';
import { Phase2Placeholder } from './components/figma/Phase2Placeholder';

export const App: React.FC = () => {
  const { activeView, isLoggedIn, currentRole } = useApp();

  // Enterprise Role-Based Route Guard
  const renderProtectedView = () => {
    if (!isLoggedIn) {
      return <CentralLogin />;
    }

    if (activeView === 'admin_portal') {
      if (currentRole === 'ADMIN') return <AdminPortal />;
      if (currentRole === 'EMPLOYEE') return <EmployeePortal />;
      return <CustomerPortal />;
    }

    if (activeView === 'employee_portal') {
      if (currentRole === 'EMPLOYEE' || currentRole === 'ADMIN') return <EmployeePortal />;
      return <CustomerPortal />;
    }

    if (activeView === 'customer_portal') {
      return <CustomerPortal />;
    }

    return <LandingPage />;
  };

  return (
    <DeviceFrame>
      <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
        {/* Context-Aware Navigation Bar */}
        <Navbar />

        {/* View Router */}
        <main className="flex-1">
          {activeView === 'landing' && <LandingPage />}
          {activeView === 'login' && <CentralLogin />}
          {['customer_portal', 'employee_portal', 'admin_portal'].includes(activeView) && renderProtectedView()}
          {activeView === 'figma_system' && <DesignSystemShowcase />}
          {activeView === 'figma_flows' && <PrototypeFlowGuide />}
          {activeView === 'phase2' && <Phase2Placeholder />}
        </main>

        {/* Global Footer (Public Landing, Login & Customer Portal) */}
        {activeView !== 'admin_portal' && activeView !== 'employee_portal' && <Footer />}

        {/* Global Modals & Notifications */}
        <AuthModal />
        <QrMarketingModal />
        <RepairEstimateModal />
        <RevisedEstimateModal />
        <ToastContainer />
      </div>
    </DeviceFrame>
  );
};

export default App;
