/** Tipe, label, dan format tampilan insiden yang dipakai halaman daftar & detail. */

export const INCIDENT_SEVERITIES = ["MINOR", "MAJOR", "CRITICAL"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  INVESTIGATING: "Investigasi",
  IDENTIFIED: "Teridentifikasi",
  MONITORING: "Dimonitor",
  RESOLVED: "Selesai",
};

export const INCIDENT_SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  CRITICAL: "Kritis",
  MAJOR: "Besar",
  MINOR: "Kecil",
};

/** Penjelasan singkat tiap tingkat agar pelapor memilih dengan konsisten. */
export const INCIDENT_SEVERITY_HINT: Record<IncidentSeverity, string> = {
  MINOR: "Sebagian kecil pelanggan, layanan masih jalan",
  MAJOR: "Banyak pelanggan terdampak atau layanan melambat",
  CRITICAL: "Layanan mati di area luas",
};

export const INCIDENT_SEVERITY_BADGE: Record<IncidentSeverity, string> = {
  CRITICAL: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  MAJOR: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  MINOR: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
};

/** Kelas lencana status: selesai hijau, selain itu biru (masih berlangsung). */
export function incidentStatusBadge(status: IncidentStatus): string {
  return status === "RESOLVED"
    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
    : "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300";
}

/** Tanggal & jam singkat Indonesia, mis. "04 Okt 2026 17.30". */
export function formatIncidentDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Area terdampak dari teks dipisah koma; butir kosong dibuang. */
export function parseAffectedAreas(text: string): string[] {
  return text
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);
}

export const INCIDENT_SEVERITY_ICON_COLOR: Record<IncidentSeverity, string> = {
  CRITICAL: "text-red-600",
  MAJOR: "text-orange-600",
  MINOR: "text-yellow-600",
};
