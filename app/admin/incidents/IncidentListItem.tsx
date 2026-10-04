import Link from "next/link";
import { HiOutlineCheckCircle } from "react-icons/hi2";
import { SeverityIcon } from "./IncidentBadges";
import {
  INCIDENT_SEVERITY_BADGE,
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_STATUS_LABEL,
  formatIncidentDateTime,
  incidentStatusBadge,
  type IncidentSeverity,
  type IncidentStatus,
} from "./incident-format";

export interface IncidentRow {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedAreas: string[];
  startedAt: string;
  resolvedAt: string | null;
  isPublic: boolean;
}

/** Satu kartu insiden di daftar; seluruh kartu menuju halaman detail. */
export function IncidentListItem({ incident }: { incident: IncidentRow }) {
  return (
    <Link
      href={`/admin/incidents/${incident.id}`}
      className="block rounded-lg bg-white p-4 shadow transition hover:shadow-md dark:bg-gray-800"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-gray-900 dark:text-white">{incident.title}</h3>
        <span
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${INCIDENT_SEVERITY_BADGE[incident.severity]}`}
        >
          <SeverityIcon severity={incident.severity} className="h-4 w-4" />
          {INCIDENT_SEVERITY_LABEL[incident.severity]}
        </span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${incidentStatusBadge(incident.status)}`}
        >
          {incident.status === "RESOLVED" && (
            <HiOutlineCheckCircle className="mr-1 inline h-3 w-3" />
          )}
          {INCIDENT_STATUS_LABEL[incident.status]}
        </span>
        {!incident.isPublic && (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            Internal
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
        {incident.description}
      </p>
      <div className="mt-2 text-xs text-gray-500">
        Mulai: {formatIncidentDateTime(incident.startedAt)}
        {incident.resolvedAt && ` • Selesai: ${formatIncidentDateTime(incident.resolvedAt)}`}
      </div>
    </Link>
  );
}
