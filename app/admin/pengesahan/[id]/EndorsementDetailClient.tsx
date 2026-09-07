"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { HiOutlineArrowLeft, HiOutlineArrowDownTray } from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import { clientLogger } from "@/lib/client-logger";

/** Detail surat: kemajuan tanda tangan, jejak berkas, dan aksi pembatalan. */

interface SignerDto {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  signedAt: string | null;
  declineReason: string | null;
}

interface DetailDto {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: string;
  signerCount: number;
  signedCount: number;
  expiresAt: string | null;
  completedAt: string | null;
  sourceFileName: string;
  sourceFileHash: string;
  signedFileHash: string | null;
  hasSignedFile: boolean;
  cancelReason: string | null;
  signers: SignerDto[];
}

const SIGNER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Belum dibuka",
  VIEWED: "Sudah dibuka",
  SIGNED: "Sudah tanda tangan",
  DECLINED: "Menolak",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";

  return new Date(value).toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EndorsementDetailClient({
  endorsementId,
}: {
  endorsementId: string;
}) {
  const { data, error, isLoading, mutate } = useApi<{ data?: DetailDto }>(
    `/api/admin/endorsements/${endorsementId}`,
  );
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const detail = data?.data;

  const cancel = async () => {
    if (cancelReason.trim().length < 3) {
      toast.error("Tuliskan alasan pembatalan");
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/endorsements/${endorsementId}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: cancelReason.trim() }),
        },
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(payload.error || "Gagal membatalkan surat");
        return;
      }

      toast.success("Surat dibatalkan");
      setIsCancelling(false);
      await mutate();
    } catch (err) {
      clientLogger.error("[Pengesahan] gagal membatalkan:", err);
      toast.error("Terjadi kesalahan jaringan");
    }
  };

  if (isLoading) return <PageLoader />;

  if (error || !detail) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Gagal memuat detail surat pengesahan.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/pengesahan"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <HiOutlineArrowLeft className="h-4 w-4" />
          Kembali ke daftar
        </Link>
        <p className="mt-2 font-mono text-xs text-gray-500 dark:text-gray-400">
          {detail.number}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {detail.title}
        </h1>
        {detail.description && (
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            {detail.description}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Kemajuan</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {detail.signedCount} dari {detail.signerCount} tanda tangan
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Berlaku sampai {formatDateTime(detail.expiresAt)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Dokumen</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {detail.sourceFileName}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={`/api/admin/endorsements/${detail.id}/file?jenis=sumber`}
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <HiOutlineArrowDownTray className="h-4 w-4" />
              Dokumen asal
            </a>
            {detail.hasSignedFile && (
              <a
                href={`/api/admin/endorsements/${detail.id}/file?jenis=pengesahan`}
                className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:underline dark:text-green-400"
              >
                <HiOutlineArrowDownTray className="h-4 w-4" />
                PDF pengesahan
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          Penanda tangan
        </h2>
        <ul className="space-y-3">
          {detail.signers.map((signer) => (
            <li
              key={signer.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 last:border-0 last:pb-0 dark:border-gray-700/60"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {signer.name}
                  {signer.role ? (
                    <span className="text-gray-500 dark:text-gray-400">
                      {" "}
                      — {signer.role}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {signer.phone || signer.email || "Tanpa kontak"}
                </p>
                {signer.declineReason && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    Alasan menolak: {signer.declineReason}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {SIGNER_STATUS_LABEL[signer.status] ?? signer.status}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDateTime(signer.signedAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        <p className="break-all">
          Sidik jari dokumen asal:{" "}
          <span className="font-mono">{detail.sourceFileHash}</span>
        </p>
        {detail.signedFileHash && (
          <p className="mt-1 break-all">
            Sidik jari PDF pengesahan:{" "}
            <span className="font-mono">{detail.signedFileHash}</span>
          </p>
        )}
      </div>

      {detail.status !== "COMPLETED" && detail.status !== "CANCELLED" && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          {isCancelling ? (
            <div className="space-y-2">
              <label
                htmlFor="alasan-batal"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Alasan pembatalan
              </label>
              <textarea
                id="alasan-batal"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <div className="flex gap-2">
                <Button
                  onClick={cancel}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Batalkan surat
                </Button>
                <Button variant="ghost" onClick={() => setIsCancelling(false)}>
                  Urung
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setIsCancelling(true)}>
              Batalkan surat
            </Button>
          )}
        </div>
      )}

      {detail.cancelReason && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          Surat dibatalkan: {detail.cancelReason}
        </p>
      )}
    </div>
  );
}
