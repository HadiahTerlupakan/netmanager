import ClaimReviewModal from "./ClaimReviewModal";
import ConfirmationModal from "./ConfirmationModal";
import ZoomImageModal from "./ZoomImageModal";
import type { ClaimModalState } from "./CanvasingListTypes";
import type { ConfirmationModalState } from "./ConfirmationModal";

interface CanvasingListModalsProps {
  claimModal: ClaimModalState;
  confirmationModal: ConfirmationModalState;
  zoomImage: string | null;
  onApproveClaim: (claimId: string) => void;
  onRejectClaim: (claimId: string, notes: string) => void;
  onCloseClaimModal: () => void;
  onConfirmRowAction: () => void;
  onCloseConfirmationModal: () => void;
  onZoomImage: (url: string) => void;
  onCloseZoomImage: () => void;
}

/** Compose canvasing claim review and image preview modals. */
export default function CanvasingListModals({
  claimModal,
  confirmationModal,
  zoomImage,
  onApproveClaim,
  onRejectClaim,
  onCloseClaimModal,
  onConfirmRowAction,
  onCloseConfirmationModal,
  onZoomImage,
  onCloseZoomImage,
}: CanvasingListModalsProps) {
  return (
    <>
      <ClaimReviewModal
        claimModal={claimModal}
        onApprove={onApproveClaim}
        onReject={onRejectClaim}
        onClose={onCloseClaimModal}
        onZoomImage={onZoomImage}
      />
      <ConfirmationModal
        modal={confirmationModal}
        onConfirm={onConfirmRowAction}
        onClose={onCloseConfirmationModal}
      />
      <ZoomImageModal imageUrl={zoomImage} onClose={onCloseZoomImage} />
    </>
  );
}
