"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/hooks/useApi";
import { Button } from "@/components/ui/Button";
import PageLoader from "@/components/ui/PageLoader";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "react-hot-toast";
import {
  HiOutlinePlus,
  HiOutlineCheckCircle,
  HiOutlineFire,
  HiOutlineExclamationCircle,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";

type Severity = "CRITICAL" | "MAJOR" | "MINOR";
type Status = "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";

interface IncidentRow {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: Status;
  affectedAreas: string[];
  startedAt: string;
  resolvedAt: string | null;
  isPublic: boolean;
}

const STATUS_LABEL: Record<Status, string> = {
  INVESTIGATING: "Investigasi",
  IDENTIFIED: "Teridentifikasi",
  MONITORING: "Dimonitor",
  RESOLVED: "Selesai",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: "Kritis",
  MAJOR: "Besar",
  MINOR: "Kecil",
};

function severityBadge(s: Severity) {
  if (s === "CRITICAL") {
    return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
  }
  if (s === "MAJOR") {
    return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300";
  }
  return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
}

function statusBadge(s: Status) {
  if (s === "RESOLVED") {
    return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
  }
  return "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300";
}

function severityIcon(s: Severity) {
  if (s === "CRITICAL") return <HiOutlineFire className="w-4 h-4" />;
  if (s === "MAJOR") return <HiOutlineExclamationCircle className="w-4 h-4" />;
  return <HiOutlineExclamationTriangle className="w-4 h-4" />;
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

export function IncidentsListClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("incidents:create");

  const [filter, setFilter] = useState<"ACTIVE" | "RESOLVED" | "all">("ACTIVE");
  const [showForm, setShowForm] = useState(false);

  const url =
    filter === "all"
      ? "/api/admin/incidents"
      : `/api/admin/incidents?status=${filter}`;
  const { data: incidents, isLoading, mutate } = useApi<IncidentRow[]>(url);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Manajemen Insiden
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pencatatan, eskalasi, dan broadcast gangguan layanan ke pelanggan.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowForm((v) => !v)} variant="default">
            <HiOutlinePlus className="w-4 h-4" />
            {showForm ? "Tutup Form" : "Insiden Baru"}
          </Button>
        )}
      </div>

      {showForm && (
        <CreateIncidentForm
          onCreated={() => {
            void mutate();
            setShowForm(false);
          }}
        />
      )}

      <div className="flex gap-2">
        {(["ACTIVE", "RESOLVED", "all"] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => setFilter(opt)}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              filter === opt
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
            }`}
          >
            {opt === "ACTIVE"
              ? "Berlangsung"
              : opt === "RESOLVED"
                ? "Selesai"
                : "Semua"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-3">
          {(incidents ?? []).map((inc) => (
            <Link
              key={inc.id}
              href={`/admin/incidents/${inc.id}`}
              className="block bg-white dark:bg-gray-800 shadow rounded-lg p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {inc.title}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${severityBadge(inc.severity)}`}
                    >
                      {severityIcon(inc.severity)}
                      {SEVERITY_LABEL[inc.severity]}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${statusBadge(inc.status)}`}
                    >
                      {inc.status === "RESOLVED" && (
                        <HiOutlineCheckCircle className="inline w-3 h-3 mr-1" />
                      )}
                      {STATUS_LABEL[inc.status]}
                    </span>
                    {!inc.isPublic && (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                        Internal
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                    {inc.description}
                  </p>
                  <div className="text-xs text-gray-500 mt-2">
                    Mulai: {formatDateTime(inc.startedAt)}
                    {inc.resolvedAt &&
                      ` • Selesai: ${formatDateTime(inc.resolvedAt)}`}
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {!incidents?.length && (
            <div className="text-center py-12 text-sm text-gray-500 bg-white dark:bg-gray-800 rounded-lg">
              Tidak ada insiden untuk filter ini.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreateIncidentForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("MAJOR");
  const [areas, setAreas] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          severity,
          isPublic,
          affectedAreas: areas
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Gagal membuat insiden");

      toast.success("Insiden berhasil dibuat");
      setTitle("");
      setDescription("");
      setAreas("");
      onCreated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Buat Insiden Baru
      </h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Judul <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Gangguan koneksi area Selatan"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Deskripsi awal <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          placeholder="Apa yang terjadi, dampak, dan langkah awal yang sedang dilakukan..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tingkat Gangguan
          </label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          >
            <option value="MINOR">Kecil</option>
            <option value="MAJOR">Besar</option>
            <option value="CRITICAL">Kritis</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Area terdampak (pisah koma)
          </label>
          <input
            type="text"
            value={areas}
            onChange={(e) => setAreas(e.target.value)}
            placeholder="Site A, Site B"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="w-4 h-4"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Tampilkan di status page publik (pelanggan bisa melihat)
        </span>
      </label>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting} variant="default">
          {submitting ? "Menyimpan..." : "Buat Insiden"}
        </Button>
      </div>
    </form>
  );
}
