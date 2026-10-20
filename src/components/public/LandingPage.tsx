import React, { useEffect, useRef } from 'react';
import { GR_SPORTS_PLATFORM_HTML, GR_SPORTS_PLATFORM_JS } from './grSportsPlatformHtml';
import { useApp } from '../../context/AppContext';

export const LandingPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { openAuthModal, openWizardWithService, setActiveView, setCustomerSubView } = useApp();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Inject HTML into container
    container.innerHTML = GR_SPORTS_PLATFORM_HTML;

    // 2. Execute platform JavaScript in a controlled sandbox function
    try {
      const runPlatformScript = new Function(GR_SPORTS_PLATFORM_JS);
      runPlatformScript();
    } catch (err) {
      console.error('Error executing GR Sports Platform JS:', err);
    }

    // 3. Trigger DOMContentLoaded initialization handlers defined in the script
    const initEvent = new Event('DOMContentLoaded', { bubbles: true, cancelable: true });
    window.dispatchEvent(initEvent);

    // 4. Connect Player Account Modal triggers to React AppContext
    const userModal = document.getElementById('userAccountModal');
    if (userModal) {
      const sendOtpBtn = userModal.querySelector('button');
      if (sendOtpBtn) {
        sendOtpBtn.addEventListener('click', () => {
          // Open our React AuthModal for real login
          setTimeout(() => {
            if (typeof (window as any).closeUserModal === 'function') {
              (window as any).closeUserModal();
            }
            openAuthModal('CUSTOMER');
          }, 300);
        });
      }
    }

    // 5. Connect Staff Access Modal to real React portals
    const staffModal = document.getElementById('staffLoginModal');
    if (staffModal) {
      const staffBtn = staffModal.querySelector('button[onclick*="authenticateStaffLogin"], button.bg-sportsBlue');
      if (staffBtn) {
        staffBtn.addEventListener('click', () => {
          const userVal = (document.getElementById('staffUserId') as HTMLInputElement)?.value.trim() || '';
          const currentRole = (window as any).currentStaffRole || 'Employee';
          
          setTimeout(() => {
            if (typeof (window as any).closeStaffLoginModal === 'function') {
              (window as any).closeStaffLoginModal();
            }
            if (currentRole === 'Admin') {
              openAuthModal('ADMIN');
            } else {
              openAuthModal('EMPLOYEE');
            }
          }, 500);
        });
      }
    }

    // 6. Connect Brand Service Booking Forms to real React orders
    const bsStringBtn = document.getElementById('btnConfirmBrandString');
    if (bsStringBtn) {
      bsStringBtn.addEventListener('click', () => {
        const brand = (document.getElementById('bsStringBrand') as HTMLSelectElement)?.value || 'Yonex';
        const model = (document.getElementById('bsStringModel') as HTMLInputElement)?.value || 'Astrox 88D Pro';
        const stringName = (document.getElementById('bsStringName') as HTMLSelectElement)?.value || 'Yonex BG65';
        const tension = parseInt((document.getElementById('bsStringTension') as HTMLSelectElement)?.value || '26', 10);
        
        console.log('GR Sports stringing booking captured:', { brand, model, stringName, tension });
      });
    }

    // 7. Cleanup timers on unmount
    return () => {
      if ((window as any).heroSlideTimer) {
        clearInterval((window as any).heroSlideTimer);
        (window as any).heroSlideTimer = null;
      }
      container.innerHTML = '';
    };
  }, [openAuthModal, openWizardWithService, setActiveView, setCustomerSubView]);

  return (
    <div
      ref={containerRef}
      className="w-full bg-slate-50 text-slate-900 font-sans selection:bg-sportsBlue selection:text-white"
    />
  );
};
