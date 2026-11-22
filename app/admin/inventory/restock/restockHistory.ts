import type { GoodsReceiptSummary, PurchaseRequest } from "./types";

/** Format tanggal pendek Indonesia, misalnya "8 Nov 2026". */
export function formatRestockDate(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Format tanggal dan jam, misalnya "8 Nov 2026 14.20". */
export function formatRestockDateTime(value: string): string {
  const date = new Date(value);
  const time = date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatRestockDate(value)} ${time}`;
}

/** Catatan barang masuk pengajuan ini, urut dari yang paling lama. */
export function getRestockGoodsReceipts(
  request: PurchaseRequest,
): GoodsReceiptSummary[] {
  return [...(request.goodsReceipts ?? [])].sort((left, right) => {
    const leftTime = left.receivedAt ? Date.parse(left.receivedAt) : 0;
    const rightTime = right.receivedAt ? Date.parse(right.receivedAt) : 0;
    return leftTime - rightTime;
  });
}

/** Isi satu catatan barang masuk dalam satu kalimat: "Kabel Fiber 6 roll, ONT 10 pcs". */
export function describeGoodsReceiptContents(
  receipt: GoodsReceiptSummary,
): string {
  const lines = receipt.items ?? [];
  if (lines.length === 0) return "Isi laporan barang sampai tidak tercatat";
  return lines
    .map((line) =>
      [line.nama ?? "Barang", String(line.quantity), line.satuan ?? ""]
        .filter((part) => part !== "")
        .join(" "),
    )
    .join(", ");
}
