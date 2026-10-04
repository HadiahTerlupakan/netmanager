import { escapeCsvCell } from "@/lib/csv";
import type { IncidentRow } from "./IncidentListItem";
import {
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_STATUS_LABEL,
  formatIncidentDateTime,
} from "./incident-format";

/** Isi CSV daftar insiden untuk diunduh, satu baris per insiden. */

const HEADERS = [
  "Judul",
  "Tingkat",
  "Status",
  "Area terdampak",
  "Mulai",
  "Selesai",
  "Tampil publik",
  "Deskripsi",
];

const AREA_SEPARATOR = "; ";

/** Susun CSV dengan kolom berlabel Indonesia; sel aman dari injeksi rumus. */
export function buildIncidentCsv(incidents: IncidentRow[]): string {
  const rows = incidents.map((incident) =>
    [
      incident.title,
      INCIDENT_SEVERITY_LABEL[incident.severity],
      INCIDENT_STATUS_LABEL[incident.status],
      incident.affectedAreas.join(AREA_SEPARATOR),
      formatIncidentDateTime(incident.startedAt),
      incident.resolvedAt ? formatIncidentDateTime(incident.resolvedAt) : "",
      incident.isPublic ? "Ya" : "Tidak",
      incident.description,
    ].map(escapeCsvCell),
  );

  return [HEADERS.map(escapeCsvCell), ...rows].map((row) => row.join(",")).join("\n");
}
