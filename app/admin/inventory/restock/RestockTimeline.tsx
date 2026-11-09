"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { FiCheck } from "react-icons/fi";

import {
  describeGoodsReceiptContents,
  formatRestockDate,
  formatRestockDateTime,
  getRestockGoodsReceipts,
  getRestockProgress,
  getRestockPurchaseStep,
  RESTOCK_STAGE_TITLES,
  SEND_PURCHASE_LINK_HINT,
  type RestockProgressKey,
  type RestockStageNumber,
} from "./restockProgress";
import {
  buildPurchaseSignatureUrl,
  describePurchaseRecordContents,
  describePurchaseRecordVoid,
  getAllRestockPurchaseRecords,
  getPurchaseBuyerName,
  isPurchaseRecordVoided,
} from "./restockPurchase";
import type {
  GoodsReceiptSummary,
  PurchaseRecordSummary,
  PurchaseRequest,
} from "./types";

interface RestockTimelineProps {
  request: PurchaseRequest;
  /** Tambahkan ajakan kirim link belanja (hanya untuk yang boleh membuatnya). */
  isShowingPurchaseLinkHint?: boolean;
  /**
   * Tampilkan kalimat "Sekarang: …" di bawah riwayat. Detail pengajuan
   * mematikannya karena kalimat itu sudah tampil di bawah daftar tahap.
   */
  isShowingCurrentSentence?: boolean;
  /**
   * Aksi pembatalan untuk satu catatan belanja yang masih berlaku; tidak
   * diisi bila pengguna tidak boleh membatalkan.
   */
  renderPurchaseVoidAction?: (
    record: PurchaseRecordSummary,
    label: string,
  ) => ReactNode;
}

interface TimelineStepProps {
  isDone: boolean;
  title: string;
  children?: ReactNode;
}

const UNDECIDED_STATUSES = new Set(["DRAFT", "SUBMITTED"]);
const FINAL_STEP_LABELS: Partial<Record<RestockProgressKey, string>> = {
  COMPLETE: "Selesai",
  COMPLETE_SHORT: "Selesai, kurang",
  CANCELLED: "Dibatalkan",
};

function TimelineStep({ isDone, title, children }: TimelineStepProps) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${isDone ? "border-green-700 bg-green-700 text-white" : "border-gray-400 bg-white dark:bg-gray-800"}`}
      >
        {isDone && <FiCheck className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-bold text-gray-900 dark:text-white">
          <span className="sr-only">{isDone ? "Sudah: " : "Belum: "}</span>
          {title}
        </p>
        {children}
      </div>
    </li>
  );
}

function joinParts(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" · ");
}

/** Deretan foto kecil yang bisa dibuka; dipakai kiriman dan nota belanja. */
function PhotoThumbnails({
  photos,
  subject,
}: {
  photos: string[];
  /** Mis. "kiriman ke-2" atau "nota belanja ke-1". */
  subject: string;
}) {
  if (photos.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((url, photoIndex) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Buka foto ${photoIndex + 1} ${subject}`}
          className="block h-16 w-16 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`Foto ${subject}`}
            className="h-full w-full object-cover"
          />
        </a>
      ))}
    </div>
  );
}

function describePhotoCount(photos: string[]): string {
  return photos.length > 0 ? ` (${photos.length} foto)` : "";
}

/**
 * Catatan yang baru saja dibatalkan di layar ini: tombol pembatalannya hilang
 * bersama fokus keyboard, jadi fokus dipindah ke keterangan "Dibatalkan".
 * Hanya bila fokus memang jatuh ke halaman; bila pengguna sudah pindah ke
 * tempat lain, fokusnya tidak direbut.
 */
function useVoidedFocusTarget(isVoided: boolean) {
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const wasVoidedRef = useRef(isVoided);

  useEffect(() => {
    const hasJustBeenVoided = isVoided && !wasVoidedRef.current;
    wasVoidedRef.current = isVoided;
    if (!hasJustBeenVoided) return;
    const focused = document.activeElement;
    if (focused && focused !== document.body) return;
    noticeRef.current?.focus();
  }, [isVoided]);

  return noticeRef;
}

function PurchaseStep({
  record,
  index,
  requestId,
  renderVoidAction,
}: {
  record: PurchaseRecordSummary;
  index: number;
  requestId: string;
  renderVoidAction?: RestockTimelineProps["renderPurchaseVoidAction"];
}) {
  const photos = record.fotoNota ?? [];
  const buyerName = getPurchaseBuyerName(record);
  const isFromLink = record.source === "PUBLIC_LINK";
  const isVoided = isPurchaseRecordVoided(record);
  const title = joinParts([
    `Belanja ke-${index + 1}`,
    formatRestockDate(record.purchasedAt),
    record.storeName,
    buyerName ? `dibeli ${buyerName}` : null,
  ]);
  const label = record.storeName
    ? `belanja ke-${index + 1} di ${record.storeName}`
    : `belanja ke-${index + 1}`;
  const voidNoticeRef = useVoidedFocusTarget(isVoided);

  return (
    <TimelineStep isDone={!isVoided} title={title}>
      <div className="flex flex-wrap gap-1">
        {isVoided && (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-900 dark:bg-red-900/50 dark:text-red-100">
            dibatalkan
          </span>
        )}
        {isFromLink && (
          <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-900 dark:bg-sky-900/50 dark:text-sky-100">
            lewat link
          </span>
        )}
      </div>
      {isVoided && (
        <p
          ref={voidNoticeRef}
          tabIndex={-1}
          className="text-sm font-semibold text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-200"
        >
          {describePurchaseRecordVoid(record)}
        </p>
      )}
      <p
        className={`text-sm text-gray-800 dark:text-gray-200 ${isVoided ? "line-through" : ""}`}
      >
        {describePurchaseRecordContents(record)}
        {describePhotoCount(photos)}
      </p>
      <PhotoThumbnails
        photos={photos}
        subject={`nota belanja ke-${index + 1}`}
      />
      {record.hasSignature && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={buildPurchaseSignatureUrl(requestId, record.id)}
          alt={`Tanda tangan ${buyerName ?? "pembeli"}`}
          loading="lazy"
          className="h-12 w-auto rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700"
        />
      )}
      {record.notes && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Catatan: {record.notes}
        </p>
      )}
      {!isVoided && renderVoidAction?.(record, label)}
    </TimelineStep>
  );
}

function ReceiptStep({
  receipt,
  index,
}: {
  receipt: GoodsReceiptSummary;
  index: number;
}) {
  const photos = receipt.fotoBukti ?? [];
  const recordedBy = receipt.receivedBy?.name
    ? `dicatat ${receipt.receivedBy.name}`
    : null;
  const title = joinParts([
    `Kiriman ke-${index + 1}`,
    receipt.receivedAt ? formatRestockDateTime(receipt.receivedAt) : null,
    recordedBy,
  ]);

  return (
    <TimelineStep isDone title={title}>
      <p className="text-sm text-gray-800 dark:text-gray-200">
        {describeGoodsReceiptContents(receipt)}
        {describePhotoCount(photos)}
      </p>
      <PhotoThumbnails photos={photos} subject={`kiriman ke-${index + 1}`} />
      <p className="text-xs text-gray-600 dark:text-gray-400">
        No. catatan: {receipt.grnNumber}
      </p>
    </TimelineStep>
  );
}

function DecisionStep({ request }: { request: PurchaseRequest }) {
  const approverName = request.approver?.name ?? null;
  if (request.status === "DRAFT") {
    return <TimelineStep isDone={false} title="Belum dikirim ke atasan" />;
  }
  if (UNDECIDED_STATUSES.has(request.status)) {
    return <TimelineStep isDone={false} title="Menunggu keputusan atasan" />;
  }
  if (request.status === "REJECTED") {
    return <TimelineStep isDone title={joinParts(["Ditolak", approverName])} />;
  }
  const approvedAt = request.approvedAt
    ? formatRestockDate(request.approvedAt)
    : null;
  return (
    <TimelineStep
      isDone
      title={joinParts([
        approvedAt ? `Disetujui ${approvedAt}` : "Disetujui",
        approverName,
      ])}
    />
  );
}

/**
 * Tanggal belanja disimpan pukul 12.00 WIB tanpa jam sebenarnya. Untuk urutan,
 * belanja ditaruh di awal harinya: barang dibeli dulu baru datang.
 */
const PURCHASE_DAY_OFFSET_MS = 12 * 60 * 60 * 1000;

interface TimelineEvent {
  time: number;
  node: ReactNode;
}

function toTime(value: string | null | undefined): number {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
}

function sortByTime(events: TimelineEvent[]): ReactNode[] {
  // Array.prototype.sort stabil: urutan asal dipakai bila waktunya sama.
  return [...events]
    .sort((left, right) => left.time - right.time)
    .map((event) => event.node);
}

/** Catatan belanja (tahap 3), urut menurut tanggal belanja. */
function buildPurchaseNodes(
  requestId: string,
  purchaseRecords: PurchaseRecordSummary[],
  renderVoidAction?: RestockTimelineProps["renderPurchaseVoidAction"],
): ReactNode[] {
  return sortByTime(
    purchaseRecords.map((record, index) => ({
      time: toTime(record.purchasedAt) - PURCHASE_DAY_OFFSET_MS,
      node: (
        <PurchaseStep
          key={`purchase-${record.id}`}
          record={record}
          index={index}
          requestId={requestId}
          renderVoidAction={renderVoidAction}
        />
      ),
    })),
  );
}

/** Kiriman barang (tahap 4), urut menurut waktu datang. */
function buildReceiptNodes(receipts: GoodsReceiptSummary[]): ReactNode[] {
  return sortByTime(
    receipts.map((receipt, index) => ({
      time: toTime(receipt.receivedAt),
      node: (
        <ReceiptStep
          key={`receipt-${receipt.id}`}
          receipt={receipt}
          index={index}
        />
      ),
    })),
  );
}

/** Satu kelompok tahap di riwayat: "3 Pembelian" beserta langkahnya. */
function StageGroup({
  stage,
  children,
}: {
  stage: RestockStageNumber;
  children: ReactNode;
}) {
  const headingId = `${useId()}-stage-${stage}`;
  return (
    <li aria-labelledby={headingId} className="space-y-2">
      <h3
        id={headingId}
        className="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300"
      >
        {stage} {RESTOCK_STAGE_TITLES[stage]}
      </h3>
      <ol className="space-y-0">{children}</ol>
    </li>
  );
}

/** Kalimat keadaan sekarang, ditambah ajakan kirim link bila diminta. */
export function describeCurrentRestockSentence(
  sentence: string,
  isShowingPurchaseLinkHint: boolean,
): string {
  return isShowingPurchaseLinkHint
    ? `${sentence} ${SEND_PURCHASE_LINK_HINT}`
    : sentence;
}

/**
 * Riwayat pengajuan dari diajukan sampai selesai, dikelompokkan per tahap:
 * 1 Pengajuan, 2 Persetujuan, 3 Pembelian (tiap belanja lewat link), dan
 * 4 Verifikasi barang sampai (tiap kiriman, lalu penutup).
 */
export function RestockTimeline({
  request,
  isShowingPurchaseLinkHint = false,
  isShowingCurrentSentence = true,
  renderPurchaseVoidAction,
}: RestockTimelineProps) {
  const progress = getRestockProgress(request);
  const isDecided =
    !UNDECIDED_STATUSES.has(request.status) && request.status !== "REJECTED";
  // Catatan yang dibatalkan tetap tampil di riwayat, dengan tandanya.
  const purchaseRecords = isDecided
    ? getAllRestockPurchaseRecords(request)
    : [];
  const purchaseStep = isDecided ? getRestockPurchaseStep(request) : null;
  const purchaseNodes = buildPurchaseNodes(
    request.id,
    purchaseRecords,
    renderPurchaseVoidAction,
  );
  const receiptNodes = buildReceiptNodes(getRestockGoodsReceipts(request));
  const currentSentence = describeCurrentRestockSentence(
    progress.sentence,
    isShowingPurchaseLinkHint,
  );
  const finalLabel = FINAL_STEP_LABELS[progress.key];
  const poNumber = request.purchaseOrder?.poNumber;
  const purchaseStepNode = purchaseStep && (
    <TimelineStep
      isDone={purchaseStep.isDone}
      title={joinParts([
        purchaseStep.label,
        purchaseStep.isDone ? purchaseStep.processedByName : null,
      ])}
    />
  );

  return (
    <section aria-label="Perjalanan pesanan" className="space-y-3">
      <ol className="space-y-4">
        <StageGroup stage={1}>
          <TimelineStep
            isDone={request.status !== "DRAFT"}
            title={joinParts([
              request.status === "DRAFT" ? "Belum diajukan" : "Diajukan",
              formatRestockDate(request.tanggal || request.createdAt),
              request.requester?.name,
            ])}
          />
        </StageGroup>
        <StageGroup stage={2}>
          <DecisionStep request={request} />
        </StageGroup>
        {isDecided && (purchaseStep || purchaseNodes.length > 0) && (
          <StageGroup stage={3}>
            {purchaseStep?.isDone && purchaseStepNode}
            {purchaseNodes}
            {purchaseStep && !purchaseStep.isDone && purchaseStepNode}
          </StageGroup>
        )}
        {isDecided && (
          <StageGroup stage={4}>
            {receiptNodes}
            <TimelineStep
              isDone={!!finalLabel}
              title={finalLabel ?? "Belum selesai"}
            />
          </StageGroup>
        )}
      </ol>
      {isShowingCurrentSentence && (
        <p className="rounded-xl bg-gray-50 p-3 text-sm font-semibold text-gray-900 dark:bg-gray-900 dark:text-gray-100">
          Sekarang: {currentSentence}
        </p>
      )}
      {poNumber && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Kode pesanan: {poNumber}
        </p>
      )}
    </section>
  );
}
