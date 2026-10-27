"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { HiArrowLeft, HiExclamationCircle } from "react-icons/hi2";
import Link from "next/link";
import PageLoader from "@/components/ui/PageLoader";
import { useApi } from "@/lib/hooks/useApi";
import { RenewPaymentFields } from "./RenewPaymentFields";
import { RenewSummaryCard, type RenewPelanggan } from "./RenewSummaryCard";
import {
  INITIAL_RENEW_FORM,
  buildRenewRequestBody,
  findTagihanTerbuka,
  formatTanggal,
  getRenewalWindowWarning,
  type RenewFormState,
} from "./renew-form.helpers";

const DEFAULT_DISABLE_DURATION_DAYS = 5;

type RenewResult = {
  invoiceId: string;
  invoiceStatus: string;
  expectedJatuhTempo: string | null;
};

/** Ambil `disablePerpanjanganPaket` (hari) dari respons setting umum. */
function readDisableDuration(settingsRaw: unknown): number {
  const obj = (settingsRaw ?? {}) as Record<string, unknown>;
  const settings = (obj.data as Record<string, unknown>) || obj;
  const value = settings.disablePerpanjanganPaket;
  if (value === undefined) return DEFAULT_DISABLE_DURATION_DAYS;
  return parseInt(String(value)) || DEFAULT_DISABLE_DURATION_DAYS;
}

async function readErrorMessage(res: Response, fallback: string) {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  return typeof body.error === "string" ? body.error : fallback;
}

export function PppClientRenewForm() {
  const params = useParams();
  const id = params.id as string;
  const [form, setForm] = useState<RenewFormState>(INITIAL_RENEW_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renewResult, setRenewResult] = useState<RenewResult | null>(null);

  const { data: settingsRaw } = useApi<unknown>("/api/settings/general");
  const { data: pelangganRaw, error: pelangganError } = useApi<unknown>(
    id ? `/api/pelanggan-ppp/${id}` : null,
  );
  const { data: tagihanRaw } = useApi<unknown>(
    id ? `/api/tagihan/pelanggan/${id}` : null,
  );

  const pelanggan = (pelangganRaw as RenewPelanggan | undefined) ?? null;
  const tagihanAktif = findTagihanTerbuka(tagihanRaw);
  const warningMessage = pelanggan
    ? getRenewalWindowWarning(
        pelanggan.jatuhTempo,
        readDisableDuration(settingsRaw),
      )
    : null;

  const handleCancelInvoice = async () => {
    if (!tagihanAktif) return;
    if (
      !confirm(
        "Apakah Anda yakin ingin membatalkan tagihan ini? Status tagihan akan diubah menjadi CANCELLED.",
      )
    )
      return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/invoices/${tagihanAktif.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, "Gagal membatalkan tagihan"),
        );
      }

      alert("Tagihan berhasil dibatalkan.");
      window.location.reload();
    } catch (err: unknown) {
      alert(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat membatalkan tagihan",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (warningMessage) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/pelanggan-ppp/${id}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRenewRequestBody(form)),
      });
      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, "Gagal memperpanjang langganan"),
        );
      }

      const body = (await res.json()) as { data: RenewResult };
      setRenewResult(body.data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memperpanjang langganan",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pelangganError && !pelanggan) {
    return (
      <CenteredNotice
        icon="❌"
        message={pelangganError.message || "Gagal memuat data pelanggan"}
        backHref="/admin/pelanggan/ppp"
        backLabel="Kembali"
      />
    );
  }

  if (!pelanggan) {
    return <PageLoader />;
  }

  if (warningMessage) {
    return (
      <CenteredNotice
        icon="⚠️"
        title="Perpanjangan Belum Tersedia"
        message={warningMessage}
        backHref="/admin/pelanggan/ppp"
        backLabel="Kembali ke Daftar Pelanggan"
      />
    );
  }

  if (renewResult) {
    return <RenewResultNotice pelangganId={id} result={renewResult} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            [PPP] Perpanjang Langganan
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Perpanjang langganan untuk pelanggan {pelanggan.nama}
          </p>
        </div>
        <Link
          href={`/admin/pelanggan/ppp/${pelanggan.id}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          <HiArrowLeft className="w-4 h-4" />
          Kembali
        </Link>
      </div>

      <RenewSummaryCard
        pelanggan={pelanggan}
        tagihanAktif={tagihanAktif}
        isSubmitting={isSubmitting}
        onCancelInvoice={handleCancelInvoice}
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <HiExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <RenewPaymentFields
          pelangganId={pelanggan.id}
          form={form}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        />

        <div className="flex items-center justify-end gap-4">
          <Link
            href={`/admin/pelanggan/ppp/${pelanggan.id}`}
            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span className="text-white">
              {isSubmitting ? "Memproses..." : "Perpanjang Langganan"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Jatuh tempo digeser worker INVOICE_PAID secara asinkron, jadi halaman
 * menyebut tanggal yang akan dipasang, bukan tanggal yang sudah tersimpan.
 */
function RenewResultNotice({
  pelangganId,
  result,
}: {
  pelangganId: string;
  result: RenewResult;
}) {
  const message = result.expectedJatuhTempo
    ? `Tagihan lunas. Jatuh tempo baru ${formatTanggal(result.expectedJatuhTempo)} diterapkan otomatis dalam beberapa saat, begitu juga aktivasi akun bila sedang terisolir.`
    : "Tagihan siklus ini sudah diterbitkan dan menunggu pembayaran. Jatuh tempo bergeser otomatis setelah tagihan lunas.";

  return (
    <CenteredNotice
      icon="✅"
      title="Perpanjangan Tersimpan"
      message={message}
      backHref={`/admin/pelanggan/ppp/${pelangganId}`}
      backLabel="Kembali ke Detail Pelanggan"
    />
  );
}

function CenteredNotice(props: {
  icon: string;
  title?: string;
  message: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-w-md">
        <div className="mb-4 text-4xl">{props.icon}</div>
        {props.title && (
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {props.title}
          </h2>
        )}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {props.message}
        </p>
        <Link
          href={props.backHref}
          className="px-6 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors"
        >
          <span className="text-white">{props.backLabel}</span>
        </Link>
      </div>
    </div>
  );
}
