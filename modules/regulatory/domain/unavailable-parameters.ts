import type { UnavailableParameter } from "./self-assessment-report";

/** Parameter Lampiran I yang datanya belum direkam sistem (tahap berikutnya). */
export const UNAVAILABLE_PARAMETERS: UnavailableParameter[] = [
  {
    group: "NETWORK",
    title: "Layanan Internet — Persentase Packet Loss (Drop Rate)",
    standardLabel: "≤ 5% (Perdirjen 1 Tahun 2021)",
    reason: "Belum ada pengukuran ping berkala per kabupaten/kota.",
  },
  {
    group: "NETWORK",
    title: "Layanan Internet — Persentase Network Latency ≤ 250 mdet",
    standardLabel: "≥ 90% (Perdirjen 1 Tahun 2021)",
    reason: "Belum ada pengukuran ping berkala per kabupaten/kota.",
  },
  {
    group: "NETWORK",
    title: "Layanan Internet — Persentase Network Availability",
    standardLabel: "≥ 99% (Perdirjen 1 Tahun 2021)",
    reason: "Belum ada riwayat naik/turun perangkat per PoP (site).",
  },
  {
    group: "NON_NETWORK",
    title: "Standar Penyelesaian Keluhan Pelanggan",
    standardLabel: "≥ 90% diselesaikan ≤ 3 hari kerja (Perdirjen 7 Tahun 2024)",
    reason:
      "Keluhan pelanggan belum dicatat sebagai tiket berkategori Komdigi.",
  },
];

/** Catatan metode yang ikut tercetak di laporan. */
export const SELF_ASSESSMENT_NOTES: string[] = [
  "Pasang baru dihitung dari work order instalasi; waktu persetujuan memakai waktu persetujuan work order, atau waktu work order dibuat bila tidak tercatat.",
  "Pemulihan layanan dihitung dari work order troubleshoot, sejak dibuat sampai selesai.",
  "Hari kerja = Senin–Jumat di luar hari libur yang tercatat di menu Hari Libur.",
  "Permohonan yang belum selesai tetapi sudah melewati batas dihitung tidak memenuhi; yang masih dalam batas belum dihitung.",
  "Work order yang dibatalkan tidak dihitung.",
  "Agregasi kuartal dan tahunan memakai rata-rata tertimbang S = Σ(Ni × Si) / Σ(Ni).",
];
