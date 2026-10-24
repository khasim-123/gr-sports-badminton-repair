import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Employee, ServiceRequest } from '../../types';
import { normalizeMobile } from '../../utils/phone';
import { byUrgency, isNewRequest, isOpen } from './jobLogic';

export interface StaffJobs {
  /** The signed-in employee's team record (matched by mobile number), once loaded. */
  me: Employee | undefined;
  /** Jobs assigned to me that still need work. */
  open: ServiceRequest[];
  /** My finished jobs, most recent first. */
  done: ServiceRequest[];
  /** New bookings nobody has accepted yet. */
  unassigned: ServiceRequest[];
}

const finishedAt = (r: ServiceRequest) => r.paymentRecord?.collectedAt || r.createdAt || '';

/** The staff member's own work list (shared by the staff portal and the top bar). */
export const useStaffJobs = (): StaffJobs => {
  const { requests, employees, userMobile } = useApp();
  return useMemo(() => {
    const mobile = normalizeMobile(userMobile);
    const me = mobile ? employees.find((e) => normalizeMobile(e.phone) === mobile) : undefined;
    const mine = me ? requests.filter((r) => r.assignedEmployeeId === me.id) : [];
    return {
      me,
      open: mine.filter(isOpen).sort(byUrgency),
      done: mine.filter((r) => !isOpen(r)).sort((a, b) => finishedAt(b).localeCompare(finishedAt(a))),
      unassigned: requests.filter(isNewRequest).sort(byUrgency),
    };
  }, [requests, employees, userMobile]);
};
