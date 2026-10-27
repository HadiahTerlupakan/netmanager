export type ServiceStatusLabel = { label: string; healthy: boolean };

/**
 * Label status layanan di dashboard portal.
 *
 * Dulu hanya melihat sesi PPPoE online, padahal pelanggan isolir tetap
 * online di pool isolir; mereka melihat "Aktif & Stabil" padahal internetnya
 * diblokir sampai tagihan dibayar.
 */
export function getServiceStatusLabel(input: {
  customerStatus: string | null | undefined;
  connectionReady: boolean;
  isOnline: boolean;
  connectionErrorLabel: string;
}): ServiceStatusLabel {
  if (input.customerStatus === "ISOLIR") {
    return { label: "Diisolir – bayar tagihan", healthy: false };
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
