"use client";

import { useEffect, useId, useRef } from "react";
import { toast } from "react-hot-toast";
import { FiCopy, FiLink, FiSend } from "react-icons/fi";

import {
  buildPurchaseLinkMessage,
  buildWhatsAppShareUrl,
  describePurchaseLinkInfo,
} from "./restockPurchaseLink";
import type { PurchaseLinkAvailability, PurchaseRequest } from "./types";
import {
  useRestockPurchaseLink,
  type PurchaseLinkConfirmation,
  type RestockPurchaseLinkState,
} from "./useRestockPurchaseLink";

interface RestockPurchaseLinkPanelProps {
  request: PurchaseRequest;
}

/**
 * Availability yang membuat panel disembunyikan, tetapi hanya selama tidak
 * ada link aktif: link yang masih hidup selalu bisa dilihat dan dimatikan.
 */
const HIDDEN_AVAILABILITIES = new Set<PurchaseLinkAvailability>([
  "CLOSED",
  "NOT_APPROVED",
]);

/** Pengajuan yang masih terbuka untuk belanja. */
const OPEN_REQUEST_STATUSES = new Set(["APPROVED", "ORDERED"]);

/** Alasan link baru tidak bisa dibuat, untuk availability selain AVAILABLE. */
const UNAVAILABLE_TEXT: Record<
  Exclude<PurchaseLinkAvailability, "AVAILABLE">,
  string
> = {
  NOT_APPROVED: "Link belanja baru bisa dibuat setelah pengajuan disetujui.",
  ALL_PURCHASED:
    "Semua barang sudah dibeli, jadi link belanja tidak diperlukan lagi.",
  CLOSED:
    "Pengajuan ini sudah selesai atau dibatalkan, jadi link belanja tidak bisa dipakai.",
  MERGED_ORDER:
    "Pengajuan ini digabung dengan pengajuan lain dalam satu pesanan, jadi link belanja tidak bisa dipakai. Catat belanja dari aplikasi.",
  STORAGE_OFF:
    "Link belanja belum bisa dibuat karena penyimpanan tanda tangan belum aktif. Hubungi admin sistem.",
};

const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 aria-disabled:opacity-50 dark:focus-visible:ring-offset-gray-900";
const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-indigo-300 bg-white px-4 py-2 text-sm font-bold text-indigo-800 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 aria-disabled:opacity-50 dark:border-indigo-700 dark:bg-gray-800 dark:text-indigo-200 dark:hover:bg-indigo-950/40 dark:focus-visible:ring-offset-gray-900";
const DANGER_BUTTON_CLASS =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 aria-disabled:opacity-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-200 dark:hover:bg-red-950/40 dark:focus-visible:ring-offset-gray-900";
const TEXT_CLASS = "text-sm text-gray-700 dark:text-gray-300";

const CONFIRMATION_TEXT: Record<
  Exclude<PurchaseLinkConfirmation, null>,
  string
> = {
  replace: "Link lama akan langsung tidak bisa dipakai. Lanjut?",
  revoke: "Link ini akan langsung tidak bisa dipakai. Lanjut?",
};

const COPY_FAILED_MESSAGE =
  "Link belum bisa disalin otomatis. Tekan lama link di atas, lalu pilih Salin.";

async function copyLink(url: string, input: HTMLInputElement | null) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link disalin");
  } catch {
    input?.select();
    toast.error(COPY_FAILED_MESSAGE);
  }
}

function ConfirmationPrompt({ state }: { state: RestockPurchaseLinkState }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { confirmation, setConfirmation, create, revoke, isBusy } = state;

  useEffect(() => {
    if (confirmation) cancelRef.current?.focus();
  }, [confirmation]);

  if (!confirmation) return null;
  return (
    <div
      role="group"
      aria-label="Konfirmasi"
      className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30"
    >
      <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
        {CONFIRMATION_TEXT[confirmation]}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-disabled={isBusy}
          onClick={() =>
            !isBusy && void (confirmation === "replace" ? create() : revoke())
          }
          className={
            confirmation === "revoke"
              ? DANGER_BUTTON_CLASS
              : PRIMARY_BUTTON_CLASS
          }
        >
          {confirmation === "revoke" ? "Ya, matikan" : "Ya, buat link baru"}
        </button>
        <button
          ref={cancelRef}
          type="button"
          onClick={() => setConfirmation(null)}
          className={SECONDARY_BUTTON_CLASS}
        >
          Batal
        </button>
      </div>
    </div>
  );
}

function CreatedLink({
  url,
  request,
}: {
  url: string;
  request: PurchaseRequest;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const message = buildPurchaseLinkMessage({
    requestNumber: request.nomorRequest,
    warehouseName: request.gudang?.nama ?? "-",
    url,
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label
          htmlFor={inputId}
          className="text-sm font-bold text-gray-900 dark:text-white"
        >
          Link belanja
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-[44px] w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-indigo-900"
        />
      </div>
      <p
        role="status"
        className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
      >
        Link ini hanya ditampilkan sekali. Salin atau kirim sekarang.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copyLink(url, inputRef.current)}
          className={PRIMARY_BUTTON_CLASS}
        >
          <FiCopy aria-hidden="true" /> Salin link
        </button>
        <a
          href={buildWhatsAppShareUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          className={SECONDARY_BUTTON_CLASS}
        >
          <FiSend aria-hidden="true" /> Kirim lewat WhatsApp
        </a>
      </div>
    </div>
  );
}

function ManageButtons({
  state,
  canCreate,
}: {
  state: RestockPurchaseLinkState;
  canCreate: boolean;
}) {
  const { isBusy, confirmation, setConfirmation } = state;
  if (confirmation) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {canCreate && (
        <button
          type="button"
          aria-disabled={isBusy}
          onClick={() => !isBusy && setConfirmation("replace")}
          className={SECONDARY_BUTTON_CLASS}
        >
          Buat link baru
        </button>
      )}
      <button
        type="button"
        aria-disabled={isBusy}
        onClick={() => !isBusy && setConfirmation("revoke")}
        className={DANGER_BUTTON_CLASS}
      >
        Matikan link
      </button>
    </div>
  );
}

function LinkBody({
  state,
  request,
}: {
  state: RestockPurchaseLinkState;
  request: PurchaseRequest;
}) {
  const { status, createdUrl, isBusy, create } = state;
  const link = status?.link ?? null;
  const availability = status?.availability ?? "AVAILABLE";
  const canCreate = availability === "AVAILABLE";
  const unavailableText =
    availability === "AVAILABLE" ? null : UNAVAILABLE_TEXT[availability];

  if (!link) {
    if (unavailableText) return <p className={TEXT_CLASS}>{unavailableText}</p>;
    return (
      <button
        type="button"
        aria-disabled={isBusy}
        onClick={() => !isBusy && void create()}
        className={PRIMARY_BUTTON_CLASS}
      >
        <FiLink aria-hidden="true" />
        {isBusy ? "Membuat link…" : "Buat link belanja"}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {createdUrl && <CreatedLink url={createdUrl} request={request} />}
      <p className={TEXT_CLASS}>{describePurchaseLinkInfo(link)}</p>
      {unavailableText && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          {unavailableText} Link ini masih berlaku; matikan kalau tidak dipakai
          lagi.
        </p>
      )}
      {!createdUrl && canCreate && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Demi keamanan, link tidak bisa ditampilkan lagi. Kalau perlu kirim
          ulang, buat link baru.
        </p>
      )}
      <ConfirmationPrompt state={state} />
      <ManageButtons state={state} canCreate={canCreate} />
    </div>
  );
}

function PanelBody({
  state,
  request,
}: {
  state: RestockPurchaseLinkState;
  request: PurchaseRequest;
}) {
  const { status, isLoading, errorMessage, reload } = state;
  if (isLoading && !status) {
    return <p className={TEXT_CLASS}>Memuat info link belanja…</p>;
  }
  if (!status) {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-sm text-red-800 dark:text-red-200">
          {errorMessage}
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          className={SECONDARY_BUTTON_CLASS}
        >
          Coba lagi
        </button>
      </div>
    );
  }
  return <LinkBody state={state} request={request} />;
}

/**
 * Panel "Link belanja" di detail pengajuan: buat, salin, kirim lewat
 * WhatsApp, buat ulang, atau matikan link daftar belanja tanpa login.
 * Disembunyikan bila pengajuan belum disetujui atau sudah ditutup, kecuali
 * masih ada link aktif (selalu bisa dimatikan).
 */
export function RestockPurchaseLinkPanel({
  request,
}: RestockPurchaseLinkPanelProps) {
  const headingId = useId();
  const state = useRestockPurchaseLink(request.id);
  const availability = state.status?.availability;
  const hasActiveLink = !!state.status?.link;
  // Pengajuan yang sudah ditutup hanya menampilkan panel bila ternyata masih
  // ada link aktif (tidak muncul sekilas saat status dimuat).
  if (!OPEN_REQUEST_STATUSES.has(request.status) && !hasActiveLink) {
    return null;
  }
  if (
    availability &&
    HIDDEN_AVAILABILITIES.has(availability) &&
    !hasActiveLink
  ) {
    return null;
  }

  const hasStatus = state.status !== null;
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={state.isLoading || state.isBusy}
      className="space-y-3 rounded-2xl border border-indigo-100 bg-white p-4 dark:border-indigo-900/50 dark:bg-gray-800"
    >
      <h3
        id={headingId}
        className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white"
      >
        <FiLink aria-hidden="true" /> Link belanja
      </h3>
      <p className={TEXT_CLASS}>
        Kirim link ini ke orang yang belanja. Dia bisa mencentang barang yang
        sudah dibeli dan tanda tangan tanpa perlu masuk ke aplikasi. Link mati
        sendiri kalau semua barang sudah dibeli.
      </p>
      <PanelBody state={state} request={request} />
      {hasStatus && state.errorMessage && (
        <p role="alert" className="text-sm text-red-800 dark:text-red-200">
          {state.errorMessage}
        </p>
      )}
    </section>
  );
}
