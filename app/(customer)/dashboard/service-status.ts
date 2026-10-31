/** Warna indikator: hijau, kuning (sedang ditangani), atau merah. */
export type ServiceStatusTone = "ok" | "warning" | "error";

export type ServiceStatusLabel = { label: string; tone: ServiceStatusTone };

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
 *
 * MAINTENANCE dan DISMANTLE juga tidak boleh jatuh ke label koneksi: sesi
 * pelanggan maintenance bisa tetap online, dan sesi pelanggan dismantle baru
 * putus beberapa saat kemudian. Teksnya sama persis dengan aplikasi mobile.
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
      ? { label: "Diisolir – bayar tagihan", tone: "error" }
      : { label: "Diisolir – hubungi admin/CS", tone: "error" };
  }
  if (input.customerStatus === "NONAKTIF") {
    return { label: "Layanan nonaktif", tone: "error" };
  }
  if (input.customerStatus === "MAINTENANCE") {
    return { label: "Dalam perbaikan teknisi", tone: "warning" };
  }
  if (input.customerStatus === "DISMANTLE") {
    return { label: "Berhenti berlangganan", tone: "error" };
  }
  if (!input.connectionReady) {
    return { label: input.connectionErrorLabel, tone: "error" };
  }
  return input.isOnline
    ? { label: "Aktif & Stabil", tone: "ok" }
    : { label: "Gangguan / Offline", tone: "error" };
}
