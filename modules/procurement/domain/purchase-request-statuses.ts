/**
 * Status pengajuan yang sudah disetujui atasan dan masih menunggu barangnya
 * masuk. Hanya pengajuan berstatus ini yang ikut berubah saat PO-nya dihapus
 * atau ditutup dari halaman procurement; pengajuan yang sudah ditolak,
 * dibatalkan, atau selesai tetap statusnya.
 */
export const APPROVED_OPEN_PURCHASE_REQUEST_STATUSES = [
  "APPROVED",
  "ORDERED",
] as const;
