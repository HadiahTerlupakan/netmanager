import { useCallback, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import type { CanvasingItem, ClaimModalState } from "./CanvasingListTypes";

const INITIAL_CLAIM_MODAL: ClaimModalState = {
  open: false,
  item: null,
  processing: false,
};

interface UseCanvasingClaimReviewOptions {
  refetch: () => Promise<void>;
}

function getClaimErrorMessage(error: unknown, fallbackMessage: string) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || fallbackMessage;
  }

  return fallbackMessage;
}

/** Manage claim review modal state and approve/reject actions. */
export function useCanvasingClaimReview({
  refetch,
}: UseCanvasingClaimReviewOptions) {
  const [claimModal, setClaimModal] =
    useState<ClaimModalState>(INITIAL_CLAIM_MODAL);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const openClaimModal = useCallback((item: CanvasingItem) => {
    setClaimModal({ open: true, item, processing: false });
  }, []);

  const closeClaimModal = useCallback(() => {
    setClaimModal(INITIAL_CLAIM_MODAL);
  }, []);

  const closeZoomImage = useCallback(() => {
    setZoomImage(null);
  }, []);

  const handleApproveClaim = useCallback(
    async (claimId: string) => {
      setClaimModal((current) => ({ ...current, processing: true }));

      try {
        await axios.put(`/api/marketing/point-claims/${claimId}`, {
          action: "approve",
        });
        toast.success("Claim poin berhasil disetujui");
        closeClaimModal();
        await refetch();
      } catch (error) {
        toast.error(getClaimErrorMessage(error, "Gagal menyetujui claim"));
        setClaimModal((current) => ({ ...current, processing: false }));
      }
    },
    [closeClaimModal, refetch],
  );

  const handleRejectClaim = useCallback(
    async (claimId: string, notes: string) => {
      if (!notes.trim()) {
        toast.error("Alasan penolakan harus diisi");
        return;
      }

      setClaimModal((current) => ({ ...current, processing: true }));

      try {
        await axios.put(`/api/marketing/point-claims/${claimId}`, {
          action: "reject",
          notes: notes.trim(),
        });
        toast.success("Claim poin ditolak");
        closeClaimModal();
        await refetch();
      } catch (error) {
        toast.error(getClaimErrorMessage(error, "Gagal menolak claim"));
        setClaimModal((current) => ({ ...current, processing: false }));
      }
    },
    [closeClaimModal, refetch],
  );

  return {
    claimModal,
    zoomImage,
    openClaimModal,
    closeClaimModal,
    handleApproveClaim,
    handleRejectClaim,
    openZoomImage: setZoomImage,
    closeZoomImage,
  };
}
