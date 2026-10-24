import React from 'react';
import { useApp } from '../../context/AppContext';
import { EstimateDialog } from './EstimateDialog';

/** First repair estimate, sent to the customer for approval. */
export const RepairEstimateModal: React.FC = () => {
  const {
    repairEstimateModalOpen,
    setRepairEstimateModalOpen,
    modalTargetRequestId,
    requests,
    approveRepairEstimate,
    declineRepairEstimate,
    distanceConfig,
  } = useApp();

  if (!repairEstimateModalOpen || !modalTargetRequestId) return null;
  const request = requests.find((r) => r.id === modalTargetRequestId);
  if (!request || !request.repairEstimate) return null;

  return (
    <EstimateDialog
      request={request}
      freeRadiusKm={distanceConfig.freeRadiusKm}
      onClose={() => setRepairEstimateModalOpen(false)}
      onApprove={() => approveRepairEstimate(request.id)}
      onDecline={() => declineRepairEstimate(request.id)}
    />
  );
};
