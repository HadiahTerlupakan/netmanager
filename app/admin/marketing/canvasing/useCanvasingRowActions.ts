import { clientLogger } from "@/lib/client-logger";
import { useCallback, useState } from "react";
import type { ConfirmationModalState } from "./ConfirmationModal";
import { toast } from "react-hot-toast";

interface UseCanvasingRowActionsOptions {
  refetch: () => Promise<void>;
}

type PendingRowAction = null | (() => Promise<void>);

const INITIAL_CONFIRMATION_MODAL: ConfirmationModalState = {
  open: false,
  title: "",
  message: "",
  confirmLabel: "",
  processing: false,
};

async function parseErrorMessage(response: Response, fallbackMessage: string) {
  const json = await response.json().catch((): null => null);
  return json?.error || fallbackMessage;
}

async function refreshAfterSuccess(
  message: string,
  refetch: () => Promise<void>,
) {
  toast.success(message);
  await refetch();
}

async function deleteCanvasing(id: string, refetch: () => Promise<void>) {
  try {
    const response = await fetch(`/api/marketing/canvasing/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error(await parseErrorMessage(response, "Gagal menghapus data"));
      return;
    }

    await refreshAfterSuccess("Data berhasil dihapus", refetch);
  } catch (error) {
    clientLogger.error("Delete error:", error);
    toast.error("Terjadi kesalahan saat menghapus data");
  }
}

async function cancelCanvasingApproval(
  id: string,
  refetch: () => Promise<void>,
) {
  try {
    const response = await fetch(`/api/marketing/canvasing/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel_approval" }),
    });

    if (!response.ok) {
      toast.error(
        await parseErrorMessage(response, "Gagal membatalkan approval"),
      );
      return;
    }

    await refreshAfterSuccess(
      "Approval dibatalkan, status kembali ke PENDING",
      refetch,
    );
  } catch (error) {
    clientLogger.error("Cancel approval error:", error);
    toast.error("Terjadi kesalahan saat membatalkan approval");
  }
}

/** Handle delete and cancel approval actions for canvasing rows. */
export function useCanvasingRowActions({
  refetch,
}: UseCanvasingRowActionsOptions) {
  const [confirmationModal, setConfirmationModal] = useState(
    INITIAL_CONFIRMATION_MODAL,
  );
  const [pendingAction, setPendingAction] = useState<PendingRowAction>(null);

  const closeConfirmationModal = useCallback(() => {
    setConfirmationModal(INITIAL_CONFIRMATION_MODAL);
    setPendingAction(null);
  }, []);

  const confirmRowAction = useCallback(async () => {
    if (!pendingAction) return;
    setConfirmationModal((current) => ({ ...current, processing: true }));
    await pendingAction();
    closeConfirmationModal();
  }, [closeConfirmationModal, pendingAction]);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      setPendingAction(() => async () => deleteCanvasing(id, refetch));
      setConfirmationModal({
        open: true,
        title: "Hapus Canvasing",
        message: `Hapus request canvasing atas nama ${name}?`,
        confirmLabel: "Hapus",
        processing: false,
      });
    },
    [refetch],
  );

  const handleCancelApproval = useCallback(
    (id: string, name: string) => {
      setPendingAction(() => async () => cancelCanvasingApproval(id, refetch));
      setConfirmationModal({
        open: true,
        title: "Batalkan Approval",
        message: `Batalkan approval untuk ${name}? Status akan kembali ke PENDING dan WO terkait akan di-unlink.`,
        confirmLabel: "Batalkan Approval",
        processing: false,
      });
    },
    [refetch],
  );

  return {
    confirmationModal,
    handleDelete,
    handleCancelApproval,
    confirmRowAction,
    closeConfirmationModal,
  };
}
