"use client";

import { type ReactNode, useId } from "react";
import { FiCheck } from "react-icons/fi";

import { PhotoThumbnailGallery } from "@/components/ui/PhotoThumbnailGallery";

import {
  getRestockStatusKey,
  isRestockServiceOnly,
} from "@/modules/inventory/client";

import {
  describeGoodsReceiptContents,
  formatRestockDate,
  formatRestockDateTime,
  getRestockGoodsReceipts,
} from "./restockHistory";
import type { GoodsReceiptSummary, PurchaseRequest } from "./types";

interface RestockTimelineProps {
  request: PurchaseRequest;
}

interface TimelineStepProps {
  isDone: boolean;
  title: string;
  children?: ReactNode;
}

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

/** Deretan foto kecil yang dibuka di pratinjau, bukan tab baru. */
function PhotoThumbnails({
  photos,
  subject,
}: {
  photos: string[];
  /** Mis. "barang sampai ke-2". */
  subject: string;
}) {
  return (
    <PhotoThumbnailGallery
      urls={photos}
      subject={subject}
      thumbnailClassName="h-16 w-16 rounded-xl"
    />
  );
}

function describePhotoCount(photos: string[]): string {
  return photos.length > 0 ? ` (${photos.length} foto)` : "";
}

/** Keputusan atasan: menunggu, ditolak, atau disetujui. */
function DecisionStep({ request }: { request: PurchaseRequest }) {
  const approverName = request.approver?.name ?? null;
  const statusKey = getRestockStatusKey(request);
  if (statusKey === "AWAITING_APPROVAL") {
    return <TimelineStep isDone={false} title="Menunggu keputusan atasan" />;
  }
  if (statusKey === "REJECTED") {
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

function ReceiptStep({
  receipt,
  ordinal,
}: {
  receipt: GoodsReceiptSummary;
  /** "ke-2" bila pengajuan lama punya lebih dari satu catatan; null bila satu. */
  ordinal: string | null;
}) {
  const photos = receipt.fotoBukti ?? [];
  const label = ordinal ? `Barang sampai ${ordinal}` : "Barang sampai";
  const recordedBy = receipt.receivedBy?.name
    ? `dicatat ${receipt.receivedBy.name}`
    : null;
  const title = joinParts([
    label,
    receipt.receivedAt ? formatRestockDateTime(receipt.receivedAt) : null,
    recordedBy,
  ]);

  return (
    <TimelineStep isDone title={title}>
      <p className="text-sm text-gray-800 dark:text-gray-200">
        {describeGoodsReceiptContents(receipt)}
        {describePhotoCount(photos)}
      </p>
      <PhotoThumbnails photos={photos} subject={label.toLowerCase()} />
      <p className="text-xs text-gray-600 dark:text-gray-400">
        No. catatan: {receipt.grnNumber}
      </p>
    </TimelineStep>
  );
}

/**
 * Langkah penutup riwayat: dibatalkan (dengan alasannya), selesai tanpa
 * barang masuk, atau langkah yang masih ditunggu. Null bila tidak ada.
 */
function ClosingStep({
  request,
  hasReceipts,
}: {
  request: PurchaseRequest;
  hasReceipts: boolean;
}) {
  const isServiceOnly = isRestockServiceOnly(request);
  switch (getRestockStatusKey(request)) {
    case "CANCELLED":
      return (
        <TimelineStep isDone title="Dibatalkan">
          {request.cancelReason && (
            <p className="text-sm text-gray-800 dark:text-gray-200">
              Alasan: {request.cancelReason}
            </p>
          )}
        </TimelineStep>
      );
    case "RECEIVED":
      if (hasReceipts) return null;
      return (
        <TimelineStep
          isDone
          title={
            isServiceOnly ? "Semua jasa selesai" : "Selesai tanpa barang sampai"
          }
        />
      );
    case "APPROVED":
      return (
        <TimelineStep
          isDone={false}
          title={
            isServiceOnly
              ? "Menunggu jasa ditandai selesai"
              : "Menunggu laporan barang sampai"
          }
        />
      );
    default:
      return null;
  }
}

/**
 * Riwayat pengajuan dari diajukan sampai selesai: diajukan, keputusan atasan,
 * tiap catatan barang masuk beserta fotonya, lalu dibatalkan atau langkah
 * yang masih ditunggu.
 */
export function RestockTimeline({ request }: RestockTimelineProps) {
  const headingId = useId();
  const receipts = getRestockGoodsReceipts(request);
  const hasManyReceipts = receipts.length > 1;
  const poNumber = request.purchaseOrder?.poNumber;

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h3
        id={headingId}
        className="px-1 text-sm font-bold text-gray-800 dark:text-gray-200"
      >
        Riwayat
      </h3>
      <ol>
        <TimelineStep
          isDone
          title={joinParts([
            "Diajukan",
            formatRestockDate(request.tanggal || request.createdAt),
            request.requester?.name,
          ])}
        />
        <DecisionStep request={request} />
        {receipts.map((receipt, index) => (
          <ReceiptStep
            key={receipt.id}
            receipt={receipt}
            ordinal={hasManyReceipts ? `ke-${index + 1}` : null}
          />
        ))}
        <ClosingStep request={request} hasReceipts={receipts.length > 0} />
      </ol>
      {poNumber && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Kode pesanan: {poNumber}
        </p>
      )}
    </section>
  );
}
