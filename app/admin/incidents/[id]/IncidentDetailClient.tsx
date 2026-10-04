"use client";

import { use, useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import PageLoader from "@/components/ui/PageLoader";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "react-hot-toast";
import {
  HiOutlineArrowLeft,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineTrash,
} from "react-icons/hi2";
import { SeverityIcon } from "../IncidentBadges";
import {
  INCIDENT_SEVERITY_ICON_COLOR,
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_STATUS_LABEL,
  formatIncidentDateTime,
  type IncidentSeverity,
  type IncidentStatus,
} from "../incident-format";

interface IncidentUpdate {
  id: string;
  status: IncidentStatus;
  message: string;
  createdAt: string;
  user?: { id: string; name: string | null } | null;
}

interface IncidentDetail {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedAreas: string[];
  startedAt: string;
  resolvedAt: string | null;
  isPublic: boolean;
  updates: IncidentUpdate[];
  user?: { id: string; name: string | null } | null;
}

export function IncidentDetailClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission("incidents:update");
  const canDelete = hasPermission("incidents:delete");

  const {
    data: incident,
    isLoading,
    mutate,
  } = useApi<IncidentDetail>(`/api/admin/incidents/${id}`);

  const handleDelete = async () => {
    if (!confirm("Hapus insiden ini? Tindakan tidak bisa dibatalkan.")) return;
    try {
      const res = await fetch(`/api/admin/incidents/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Gagal menghapus");
      }
      toast.success("Insiden dihapus");
      router.push("/admin/incidents");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  if (isLoading) return <PageLoader />;
  if (!incident) return <div className="p-8">Insiden tidak ditemukan.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/incidents"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <HiOutlineArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {incident.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Mulai {formatIncidentDateTime(incident.startedAt)}
              {incident.resolvedAt &&
                ` • Selesai ${formatIncidentDateTime(incident.resolvedAt)}`}
            </p>
          </div>
        </div>
        {canDelete && (
          <Button onClick={handleDelete} variant="outline">
            <HiOutlineTrash className="w-4 h-4 text-red-600" />
            Hapus
          </Button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <SeverityIcon
            severity={incident.severity}
            className={`h-5 w-5 ${INCIDENT_SEVERITY_ICON_COLOR[incident.severity]}`}
          />
          <span className="font-semibold text-gray-900 dark:text-white">
            {INCIDENT_SEVERITY_LABEL[incident.severity]}
          </span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-700 dark:text-gray-300">
            Status: {INCIDENT_STATUS_LABEL[incident.status]}
          </span>
          {!incident.isPublic && (
            <span className="ml-auto px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded">
              Internal
            </span>
          )}
        </div>

        <p className="text-gray-700 dark:text-gray-300">
          {incident.description}
        </p>

        {incident.affectedAreas.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs text-gray-500">Area terdampak:</span>
            {incident.affectedAreas.map((area) => (
              <span
                key={area}
                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded"
              >
                {area}
              </span>
            ))}
          </div>
        )}
      </div>

      {canUpdate && incident.status !== "RESOLVED" && (
        <AddUpdateForm
          incidentId={id}
          currentStatus={incident.status}
          onAdded={() => void mutate()}
        />
      )}

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Riwayat Update
          </h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {incident.updates.map((u) => (
            <div key={u.id} className="p-4 flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                {u.status === "RESOLVED" ? (
                  <HiOutlineCheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <HiOutlineExclamationCircle className="w-4 h-4 text-indigo-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white text-sm">
                    {INCIDENT_STATUS_LABEL[u.status]}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatIncidentDateTime(u.createdAt)}
                  </span>
                  {u.user?.name && (
                    <span className="text-xs text-gray-400">
                      oleh {u.user.name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                  {u.message}
                </p>
              </div>
            </div>
          ))}
          {incident.updates.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-500">
              Belum ada update.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddUpdateForm({
  incidentId,
  currentStatus,
  onAdded,
}: {
  incidentId: string;
  currentStatus: IncidentStatus;
  onAdded: () => void;
}) {
  const [status, setStatus] = useState<IncidentStatus>(currentStatus);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`/api/admin/incidents/${incidentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, message }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Gagal menambah update");
      toast.success("Update berhasil ditambahkan");
      setMessage("");
      onAdded();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal");
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
        Tambah Update
      </h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Status baru
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as IncidentStatus)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        >
          <option value="INVESTIGATING">Investigasi</option>
          <option value="IDENTIFIED">Teridentifikasi</option>
          <option value="MONITORING">Dimonitor</option>
          <option value="RESOLVED">Selesai</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Pesan update <span className="text-red-500">*</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={3}
          placeholder="Update progress untuk pelanggan..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting} variant="default">
          {submitting ? "Menyimpan..." : "Tambah Update"}
        </Button>
      </div>
    </form>
  );
}
