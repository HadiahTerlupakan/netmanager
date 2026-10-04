"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { HiOutlineArrowPath } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { clientLogger } from "@/lib/client-logger";
import SignerLinkCopy from "../SignerLinkCopy";

interface ReissueResponse {
  error?: string;
  data?: {
    delivery: { delivered: boolean; channel: string; error?: string };
    link: { url: string };
  };
}

/**
 * Terbitkan ulang tautan satu penanda tangan. Tautan lama gugur; tautan baru
 * dikirim otomatis dan juga ditampilkan untuk disalin bila pengiriman gagal.
 * Untuk karyawan internal, ini berarti mengirim ulang notifikasi aplikasi.
 */
export default function SignerReissueButton({
  endorsementId,
  signerId,
  isInternal,
}: {
  endorsementId: string;
  signerId: string;
  isInternal: boolean;
}) {
  const [isReissuing, setIsReissuing] = useState(false);
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);

  const reissue = async () => {
    setIsReissuing(true);
    try {
      const response = await fetch(
        `/api/admin/endorsements/${endorsementId}/signers/${signerId}/reissue`,
        { method: "POST" },
      );
      const payload = (await response.json()) as ReissueResponse;

      if (!response.ok || !payload.data) {
        toast.error(payload.error || "Gagal menerbitkan ulang tautan");
        return;
      }

      const { delivery, link } = payload.data;
      if (delivery.channel === "app" && delivery.delivered) {
        toast.success("Pengingat terkirim ke aplikasi mobile");
        return;
      }
      setIssuedUrl(link.url);
      if (delivery.delivered) {
        toast.success(`Tautan baru terkirim lewat ${delivery.channel}`);
      } else {
        toast("Tautan baru dibuat — salin dan kirim manual", { icon: "⚠️" });
      }
    } catch (error) {
      clientLogger.error("[Pengesahan] gagal menerbitkan ulang tautan:", error);
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setIsReissuing(false);
    }
  };

  return (
    <div className="mt-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={reissue}
        disabled={isReissuing}
      >
        <HiOutlineArrowPath />
        {isReissuing
          ? "Mengirim..."
          : isInternal
            ? "Ingatkan lewat aplikasi"
            : "Kirim ulang tautan"}
      </Button>
      {issuedUrl && <SignerLinkCopy url={issuedUrl} />}
    </div>
  );
}
