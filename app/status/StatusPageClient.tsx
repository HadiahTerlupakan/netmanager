"use client";

import { useApi } from "@/lib/hooks/useApi";
import {
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineExclamationCircle,
  HiOutlineFire,
} from "react-icons/hi2";

interface IncidentSummary {
  id: string;
  title: string;
  description: string;
  severity: "CRITICAL" | "MAJOR" | "MINOR";
  status: "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";
  affectedAreas: string[];
  startedAt: string;
  resolvedAt: string | null;
  updatedAt: string;
}

interface StatusResponse {
  active: IncidentSummary[];
  recent: IncidentSummary[];
}

const SEVERITY_LABEL: Record<IncidentSummary["severity"], string> = {
  CRITICAL: "Kritis",
  MAJOR: "Besar",
  MINOR: "Kecil",
};

const STATUS_LABEL: Record<IncidentSummary["status"], string> = {
  INVESTIGATING: "Sedang Investigasi",
  IDENTIFIED: "Penyebab Teridentifikasi",
  MONITORING: "Sedang Dimonitor",
  RESOLVED: "Selesai",
};

function severityClass(severity: IncidentSummary["severity"]) {
  if (severity === "CRITICAL") {
    return "border-red-500 bg-red-50 dark:bg-red-900/20";
  }
  if (severity === "MAJOR") {
    return "border-orange-500 bg-orange-50 dark:bg-orange-900/20";
  }
  return "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20";
}

function severityIcon(severity: IncidentSummary["severity"]) {
  if (severity === "CRITICAL") {
    return <HiOutlineFire className="w-5 h-5 text-red-600" />;
  }
  if (severity === "MAJOR") {
    return <HiOutlineExclamationCircle className="w-5 h-5 text-orange-600" />;
  }
  return <HiOutlineExclamationTriangle className="w-5 h-5 text-yellow-600" />;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StatusPageClient() {
  const { data, isLoading, error } = useApi<StatusResponse>(
    "/api/public/status",
    { refreshInterval: 60_000 },
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Status Layanan
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Pemantauan real-time gangguan jaringan dan layanan kami.
          </p>
        </header>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
            Tidak dapat memuat status. Coba beberapa saat lagi.
          </div>
        )}

        {isLoading && !data ? (
          <div className="text-center text-gray-500">Memuat...</div>
        ) : data ? (
          <>
            <SummaryBanner active={data.active} />

            {data.active.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Sedang Berlangsung
                </h2>
                <div className="space-y-3">
                  {data.active.map((inc) => (
                    <IncidentCard key={inc.id} incident={inc} />
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Riwayat Insiden Terkini
              </h2>
              {data.recent.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tidak ada insiden yang tercatat.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.recent.map((inc) => (
                    <IncidentCard key={inc.id} incident={inc} resolved />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}

        <footer className="text-center text-xs text-gray-400 pt-8">
          Halaman ini diperbarui otomatis setiap menit.
        </footer>
      </div>
    </div>
  );
}

function SummaryBanner({ active }: { active: IncidentSummary[] }) {
  if (active.length === 0) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-6 flex items-center gap-3">
        <HiOutlineCheckCircle className="w-8 h-8 text-emerald-600" />
        <div>
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">
            Semua sistem beroperasi normal
          </p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Tidak ada gangguan yang sedang berlangsung saat ini.
          </p>
        </div>
      </div>
    );
  }

  const hasCritical = active.some((i) => i.severity === "CRITICAL");
  return (
    <div
      className={`border rounded-lg p-6 flex items-center gap-3 ${
        hasCritical
          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
          : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
      }`}
    >
      <HiOutlineExclamationCircle
        className={`w-8 h-8 ${
          hasCritical ? "text-red-600" : "text-orange-600"
        }`}
      />
      <div>
        <p
          className={`font-semibold ${
            hasCritical
              ? "text-red-900 dark:text-red-200"
              : "text-orange-900 dark:text-orange-200"
          }`}
        >
          {active.length} gangguan sedang berlangsung
        </p>
        <p
          className={`text-sm ${
            hasCritical
              ? "text-red-700 dark:text-red-400"
              : "text-orange-700 dark:text-orange-400"
          }`}
        >
          Tim kami sedang menangani.
        </p>
      </div>
    </div>
  );
}

function IncidentCard({
  incident,
  resolved,
}: {
  incident: IncidentSummary;
  resolved?: boolean;
}) {
  return (
    <div
      className={`border-l-4 rounded p-4 ${
        resolved
          ? "border-gray-400 bg-white dark:bg-gray-800"
          : severityClass(incident.severity)
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {!resolved && severityIcon(incident.severity)}
          {resolved && (
            <HiOutlineCheckCircle className="w-5 h-5 text-emerald-600" />
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {incident.title}
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
              {incident.description}
            </p>
          </div>
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {SEVERITY_LABEL[incident.severity]}
        </span>
      </div>

      {incident.affectedAreas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {incident.affectedAreas.map((area) => (
            <span
              key={area}
              className="px-2 py-0.5 text-xs bg-white/60 dark:bg-gray-700/60 rounded"
            >
              {area}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 flex flex-wrap gap-3">
        <span>Status: {STATUS_LABEL[incident.status]}</span>
        <span>Mulai: {formatDateTime(incident.startedAt)}</span>
        {incident.resolvedAt && (
          <span>Selesai: {formatDateTime(incident.resolvedAt)}</span>
        )}
      </div>
    </div>
  );
}
