"use client";

import { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { clientLogger } from "@/lib/client-logger";
import SignaturePad, { type SignaturePadHandle } from "./SignaturePad";

/**
 * Tampilan penanda tangan: dokumen di atas, kanvas tanda tangan di bawah.
 *
 * Dokumen dimuat lewat rute bertoken, bukan URL penyimpanan, sehingga tautan
 * berkas tidak bisa dibagikan lepas dari surat ini.
 */

interface Props {
  token: string;
  number: string;
  title: string;
  description: string | null;
  status: string;
  expiresAt: string | null;
  signerName: string;
  signerRole: string | null;
  signerStatus: string;
  signedCount: number;
  signerCount: number;
}

const SIGNABLE_STATUSES = ["PENDING", "VIEWED"];

function formatDate(value: string | null): string | null {
  if (!value) return null;

  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function EndorsementSignClient(props: Props) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signerStatus, setSignerStatus] = useState(props.signerStatus);
  const [isDeclining, setIsDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const canSign =
    props.status === "SENT" && SIGNABLE_STATUSES.includes(signerStatus);

  const submit = async (path: string, body: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/p/${props.token}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(payload.error || "Gagal memproses permintaan");
        return false;
      }

      return true;
    } catch (error) {
      clientLogger.error("[Pengesahan] gagal:", error);
      toast.error("Terjadi kesalahan jaringan");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSign = async () => {
    const dataUrl = padRef.current?.toDataUrl();
    if (!dataUrl) {
      toast.error("Bubuhkan tanda tangan terlebih dahulu");
      return;
    }

    if (await submit("sign", { signatureDataUrl: dataUrl })) {
      setSignerStatus("SIGNED");
      toast.success("Terima kasih, tanda tangan Anda tersimpan");
    }
  };

  const handleDecline = async () => {
    if (declineReason.trim().length < 3) {
      toast.error("Tuliskan alasan penolakan");
      return;
    }

    if (await submit("decline", { reason: declineReason.trim() })) {
      setSignerStatus("DECLINED");
      toast.success("Penolakan Anda tercatat");
    }
  };

  const expiry = formatDate(props.expiresAt);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
            {props.number}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {props.title}
          </h1>
          {props.description && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {props.description}
            </p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">
                Penanda tangan
              </dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {props.signerName}
                {props.signerRole ? ` — ${props.signerRole}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Kemajuan</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {props.signedCount} dari {props.signerCount} sudah
                menandatangani
              </dd>
            </div>
            {expiry && (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">
                  Berlaku sampai
                </dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {expiry}
                </dd>
              </div>
            )}
          </dl>
        </header>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
          <object
            data={`/api/p/${props.token}/file`}
            type="application/pdf"
            className="h-[60vh] w-full rounded-lg"
            aria-label="Dokumen yang akan disahkan"
          >
            <p className="p-4 text-sm text-gray-600 dark:text-gray-300">
              Peramban Anda tidak bisa menampilkan PDF.{" "}
              <a
                href={`/api/p/${props.token}/file`}
                className="text-indigo-600 dark:text-indigo-400 underline"
              >
                Buka dokumen
              </a>
            </p>
          </object>
        </section>

        {signerStatus === "SIGNED" && (
          <p className="rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-800 dark:text-green-300">
            Anda sudah menandatangani surat ini. Dokumen final dikirimkan
            setelah semua pihak selesai.
          </p>
        )}

        {signerStatus === "DECLINED" && (
          <p className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-300">
            Anda menolak mengesahkan surat ini.
          </p>
        )}

        {!canSign &&
          signerStatus !== "SIGNED" &&
          signerStatus !== "DECLINED" && (
            <p className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-sm text-gray-600 dark:text-gray-300">
              Surat ini sudah tidak bisa ditandatangani.
            </p>
          )}

        {canSign && (
          <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Bubuhkan tanda tangan
            </h2>
            <SignaturePad ref={padRef} />

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSign} disabled={isSubmitting}>
                Setujui &amp; tanda tangani
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsDeclining((open) => !open)}
                disabled={isSubmitting}
              >
                Tolak
              </Button>
            </div>

            {isDeclining && (
              <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                <label
                  htmlFor="alasan-tolak"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Alasan penolakan
                </label>
                <textarea
                  id="alasan-tolak"
                  value={declineReason}
                  onChange={(event) => setDeclineReason(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  placeholder="Contoh: nilai pada halaman 2 belum sesuai"
                />
                <Button
                  variant="ghost"
                  onClick={handleDecline}
                  disabled={isSubmitting}
                  className="text-red-600 dark:text-red-400"
                >
                  Kirim penolakan
                </Button>
              </div>
            )}
          </section>
        )}

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          Tautan ini bersifat rahasia. Jangan diteruskan ke pihak lain.
        </p>
      </div>
    </main>
  );
}
