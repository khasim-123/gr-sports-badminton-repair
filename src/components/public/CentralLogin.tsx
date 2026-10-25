import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { SignInPanel, signInHeading } from './SignInPanel';

/**
 * Full-page sign in (shown when a signed-out visitor lands on a portal page).
 * Customer: mobile + SMS code · Staff: mobile + password · Admin: mobile + password.
 */
export const CentralLogin: React.FC = () => {
  const { loginRoleTab, setLoginRoleTab } = useApp();
  const [role, setRole] = useState<UserRole>(loginRoleTab || 'CUSTOMER');
  const [stage, setStage] = useState<{ stage: 'MOBILE' | 'OTP' | 'PROFILE'; mobile: string | null }>({ stage: 'MOBILE', mobile: null });
  const heading = signInHeading(role, stage.stage, stage.mobile);

  const changeRole = (next: UserRole) => {
    setRole(next);
    setLoginRoleTab(next);
  };

  return (
    <div className="bg-paper px-4 py-8 sm:py-12">
      <div className="max-w-md mx-auto">
        <section className="bg-white rounded-2xl border border-line shadow-sm p-5 sm:p-6 space-y-4">
          <div>
            <h1 className="font-display tracking-[0.01em] text-2xl font-bold text-slate-900">{heading.title}</h1>
            <p className="text-sm text-slate-600 mt-1">{heading.text}</p>
          </div>
          <SignInPanel
            role={role}
            tabs="all"
            onRoleChange={changeRole}
            onStageChange={(s, mobile) => setStage({ stage: s, mobile })}
          />
        </section>
      </div>
    </div>
  );
};
