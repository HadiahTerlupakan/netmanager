"use client";

import { useState } from "react";

import { clientLogger } from "@/lib/client-logger";
import { useApi } from "@/lib/hooks/useApi";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import {
  MinVersionPanel,
  type MinVersionOverview,
  type MinVersionRelease,
} from "./MinVersionPanel";

const ENDPOINT = "/api/admin/app-update/min-version";

/** Tab "Versi Minimum": penguncian versi lama berdasarkan rilis Play Store. */
export function MobileMinVersionTab() {
  const { showToast } = useToast();
  const { hasPermission } = usePermission();
  const {
    data: overview,
    error,
    refetch,
  } = useApi<MinVersionOverview>(ENDPOINT);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<MinVersionRelease | null>(null);
  const [enforcing, setEnforcing] = useState<MinVersionRelease | null>(null);

  const run = async (request: () => Promise<Response>, success: string) => {
    setBusy(true);
    try {
      const response = await request();
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Gagal menyimpan");
      showToast("success", success);
      await refetch();
    } catch (error) {
      clientLogger.error("Aksi versi minimum gagal:", error);
      showToast("error", error instanceof Error ? error.message : "Gagal");
    } finally {
      setBusy(false);
    }
  };

  const confirmToggle = async () => {
    if (!pending) return;
    const cancelled = pending.status !== "CANCELLED";
    setPending(null);
    await run(
      () =>
        fetch(`${ENDPOINT}/${pending.versionCode}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cancelled }),
        }),
      cancelled ? "Penguncian dibatalkan" : "Penguncian diaktifkan kembali",
    );
  };

  const confirmEnforce = async () => {
    if (!enforcing) return;
    const versionCode = enforcing.versionCode;
    setEnforcing(null);
    await run(
      () =>
        fetch(`${ENDPOINT}/${versionCode}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enforceNow: true }),
        }),
      "Versi ini sekarang wajib",
    );
  };

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Gagal memuat versi minimum aplikasi.
      </p>
    );
  }
  if (!overview) {
    return <p className="text-sm text-gray-500">Memuat…</p>;
  }

  const cancelling = pending?.status !== "CANCELLED";
  return (
    <>
      <MinVersionPanel
        overview={overview}
        canUpdate={hasPermission("app_version:update")}
        busy={busy}
        onToggle={setPending}
        onEnforceNow={setEnforcing}
        onSync={() =>
          void run(
            () => fetch(ENDPOINT, { method: "POST" }),
            "Sinkronisasi Google Play selesai",
          )
        }
      />
      <ConfirmDialog
        open={!!pending}
        title={cancelling ? "Batalkan penguncian" : "Aktifkan kembali"}
        description={
          pending
            ? cancelling
              ? `Rilis build ${pending.versionCode} tidak lagi dijadikan versi wajib; versi sebelumnya kembali boleh login.`
              : `Rilis build ${pending.versionCode} kembali dijadikan dasar versi wajib.`
            : ""
        }
        confirmText={cancelling ? "Batalkan penguncian" : "Aktifkan kembali"}
        cancelText="Tutup"
        onConfirm={() => void confirmToggle()}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={!!enforcing}
        title="Wajibkan sekarang"
        description={
          enforcing
            ? `Mulai sekarang hanya build ${enforcing.versionCode} ke atas yang bisa login di aplikasi mobile; semua versi lebih lama langsung ditolak, termasuk yang sedang login. Lanjutkan hanya bila rilis ini sudah lolos review Google dan bisa diunduh dari Play Store.`
            : ""
        }
        confirmText="Wajibkan sekarang"
        cancelText="Tutup"
        onConfirm={() => void confirmEnforce()}
        onCancel={() => setEnforcing(null)}
      />
    </>
  );
}
