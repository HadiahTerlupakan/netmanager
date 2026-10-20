"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { sendRequest } from "@/app/admin/network/mikrotik/[id]/edit/routerVpnRequest";

type RevertToPublicButtonProps = {
  routerId: string;
  publicIpAddress: string | null;
  /** Dipanggil setelah router kembali ke IP publik. */
  onReverted: () => Promise<void> | void;
};

/** Tombol "Kembali ke publik" beserta konfirmasinya. */
export function RevertToPublicButton({
  routerId,
  publicIpAddress,
  onReverted,
}: RevertToPublicButtonProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  const revert = async () => {
    setIsReverting(true);
    try {
      const json = await sendRequest(
        `/api/mikrotik-routers/${routerId}/vpn/revert`,
        "POST",
      );
      const result = json.data as { warning?: string };
      toast.success("Router kembali memakai IP publik");
      if (result.warning) toast(result.warning, { icon: "⚠️" });
      setIsConfirmOpen(false);
      await onReverted();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal kembali ke IP publik",
      );
    } finally {
      setIsReverting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={!publicIpAddress}
        onClick={() => setIsConfirmOpen(true)}
      >
        Kembali ke publik
      </Button>
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Kembali ke IP publik?"
      >
        <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
          <p>
            Router akan kembali diakses lewat IP publik {publicIpAddress}.
            RADIUS publik dipasang lebih dulu lewat tunnel, jadi login PPPoE
            tetap berjalan.
          </p>
          <p>
            Tunnel WireGuard tetap terpasang di router sampai Anda menghapusnya
            sendiri. API router lewat IP publik tidak harus bisa dijangkau
            sekarang.
          </p>
          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsConfirmOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={isReverting}
              onClick={() => void revert()}
            >
              Kembali ke publik
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </>
  );
}
