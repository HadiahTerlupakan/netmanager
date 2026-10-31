export type ServiceStatusLabel = { label: string; healthy: boolean };

/**
 * Label status layanan di dashboard portal.
 *
 * Dulu hanya melihat sesi PPPoE online, padahal pelanggan isolir tetap
 * online di pool isolir; mereka melihat "Aktif & Stabil" padahal internetnya
 * diblokir sampai tagihan dibayar.
 *
 * Isolir tanpa tunggakan (diisolir manual oleh admin) tidak boleh menyuruh
 * bayar: layar yang sama menampilkan "Tagihan lunas". Bila tagihan belum bisa
 * diverifikasi, `hasOutstandingInvoice` false dan pelanggan diarahkan ke CS.
 */
export function getServiceStatusLabel(input: {
  customerStatus: string | null | undefined;
  connectionReady: boolean;
  isOnline: boolean;
  connectionErrorLabel: string;
  hasOutstandingInvoice: boolean;
}): ServiceStatusLabel {
  if (input.customerStatus === "ISOLIR") {
    return input.hasOutstandingInvoice
      ? { label: "Diisolir – bayar tagihan", healthy: false }
      : { label: "Diisolir – hubungi admin/CS", healthy: false };
  }
  if (input.customerStatus === "NONAKTIF") {
    return { label: "Layanan nonaktif", healthy: false };
  }
  if (!input.connectionReady) {
    return { label: input.connectionErrorLabel, healthy: false };
  }
  return input.isOnline
    ? { label: "Aktif & Stabil", healthy: true }
    : { label: "Gangguan / Offline", healthy: false };
}
