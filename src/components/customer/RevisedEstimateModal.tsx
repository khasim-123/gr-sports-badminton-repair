import React from 'react';
import { useApp } from '../../context/AppContext';
import { EstimateDialog } from './EstimateDialog';

/** Revised (higher) repair estimate: shows the reason and the change against the earlier estimate. */
export const RevisedEstimateModal: React.FC = () => {
  const {
    revisedEstimateModalOpen,
    setRevisedEstimateModalOpen,
    modalTargetRequestId,
    requests,
    approveRepairEstimate,
    declineRepairEstimate,
    distanceConfig,
  } = useApp();

  if (!revisedEstimateModalOpen || !modalTargetRequestId) return null;
  const request = requests.find((r) => r.id === modalTargetRequestId);
  if (!request || !request.repairEstimate) return null;

  return (
    <EstimateDialog
      request={request}
      freeRadiusKm={distanceConfig.freeRadiusKm}
      onClose={() => setRevisedEstimateModalOpen(false)}
      onApprove={() => approveRepairEstimate(request.id)}
      onDecline={() => declineRepairEstimate(request.id)}
    />
  );
};
