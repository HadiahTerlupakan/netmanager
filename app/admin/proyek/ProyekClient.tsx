"use client";

import { useMemo, useState } from "react";
import { HiOutlineClipboardDocumentList, HiOutlinePlus } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { usePermission } from "@/hooks/use-permission";
import { useApi } from "@/lib/hooks/useApi";
import type { SiteOption } from "@/types/admin-options";
import RABForm from "./RABForm";
import RABList from "./RABList";
import RABRevisionForm from "./RABRevisionForm";
import RABView from "./RABView";
import type { RABProject } from "./rabTypes";

interface RabBottleneckMetrics {
  pendingApprovalCount: number;
  oldestPendingDays: number;
  oldestPendingProjectName: string | null;
  averageApprovalLeadHours: number;
}

export default function ProyekClient() {
  const { hasPermission } = usePermission();

  const canCreate = hasPermission("expense:create");
  const canUpdate = hasPermission("expense:update");

  const [isRABModalOpen, setIsRABModalOpen] = useState(false);
  const [editingRAB, setEditingRAB] = useState<RABProject | null>(null);
  const [isRABViewOpen, setIsRABViewOpen] = useState(false);
  const [viewingRAB, setViewingRAB] = useState<RABProject | null>(null);
  const [isRABRevisionModalOpen, setIsRABRevisionModalOpen] = useState(false);
  const [revisioningRAB, setRevisioningRAB] = useState<RABProject | null>(null);
  const [rabRefreshKey, setRabRefreshKey] = useState(0);

  // Site sengaja tidak dari /api/admin/sites: endpoint itu menuntut site:read,
  // padahal pemegang expense:* belum tentu punya. /api/sites cukup login dan
  // membatasi pilihan ke site user bila role memegang expense:site_only.
  const { data: sitesResp } = useApi<{ sites?: SiteOption[] }>(
    "/api/sites?resource=expense",
  );
  const sites: SiteOption[] = useMemo(
    () => (sitesResp?.sites ?? []).map((s) => ({ id: s.id, name: s.name })),
    [sitesResp],
  );

  const rabProjectsKey = rabRefreshKey
    ? `/api/proyek?refreshKey=${rabRefreshKey}`
    : "/api/proyek";
  const { data: rabProjectsResp } = useApi<RABProject[]>(rabProjectsKey);
  const rabProjects: RABProject[] = useMemo(
    () => (Array.isArray(rabProjectsResp) ? rabProjectsResp : []),
    [rabProjectsResp],
  );

  const { data: rabMetricsResp, isLoading: isLoadingRabMetrics } =
    useApi<RabBottleneckMetrics>("/api/proyek/dashboard");
  const rabBottleneckMetrics: RabBottleneckMetrics | null =
    rabMetricsResp ?? null;

  const handleOpenRABModal = () => {
    setEditingRAB(null);
    setIsRABModalOpen(true);
  };

  const handleEditRAB = (project: RABProject) => {
    setEditingRAB(project);
    setIsRABModalOpen(true);
  };

  const handleViewRAB = (project: RABProject) => {
    setViewingRAB(project);
    setIsRABViewOpen(true);
  };

  const handleOpenRABRevision = (project: RABProject) => {
    setRevisioningRAB(project);
    setIsRABRevisionModalOpen(true);
  };

  const handleRABSaved = () => {
    setRabRefreshKey((prev) => prev + 1);
    setIsRABModalOpen(false);
  };

  const handleRABRevisionSaved = async () => {
    setRabRefreshKey((prev) => prev + 1);
    if (viewingRAB) {
      try {
        const res = await fetch(`/api/proyek?refreshKey=${Date.now()}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const updated = json.data.find(
            (p: RABProject) => p.id === viewingRAB.id,
          );
          if (updated) setViewingRAB(updated);
        }
      } catch {
        // fallback: list will refresh via rabRefreshKey
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineClipboardDocumentList className="w-7 h-7 text-blue-500" />
            Proyek (RAB)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Rencana anggaran biaya proyek, revisi, dan realisasinya
          </p>
        </div>

        {canCreate && (
          <div className="flex gap-2">
            <Button onClick={handleOpenRABModal} variant="default">
              <HiOutlinePlus className="w-5 h-5" />
              <span className="hidden sm:inline">Buat RAB Baru</span>
              <span className="sm:hidden">Tambah</span>
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
              Pending Approval
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
              {isLoadingRabMetrics
                ? "..."
                : (rabBottleneckMetrics?.pendingApprovalCount ?? 0)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              RAB sedang menunggu approver
            </p>
          </div>

          <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
              Oldest Pending
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
              {isLoadingRabMetrics
                ? "..."
                : `${rabBottleneckMetrics?.oldestPendingDays ?? 0} hari`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
              {rabBottleneckMetrics?.oldestPendingProjectName ||
                "Belum ada antrian pending"}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
              Rata-rata Approval
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
              {isLoadingRabMetrics
                ? "..."
                : `${rabBottleneckMetrics?.averageApprovalLeadHours ?? 0} jam`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Lead time approval dari pengajuan
            </p>
          </div>
        </div>

        <RABList
          initialData={rabProjects}
          refreshKey={rabRefreshKey}
          onEdit={handleEditRAB}
          onView={handleViewRAB}
          onRevise={handleOpenRABRevision}
          onRefreshRequested={handleRABRevisionSaved}
        />

        <RABForm
          isOpen={isRABModalOpen}
          onClose={() => setIsRABModalOpen(false)}
          onSaved={handleRABSaved}
          initialData={editingRAB}
          sites={sites}
        />

        <RABView
          isOpen={isRABViewOpen}
          data={viewingRAB}
          onRefresh={handleRABRevisionSaved}
          onOpenRevision={canUpdate ? handleOpenRABRevision : undefined}
          onClose={() => setIsRABViewOpen(false)}
        />

        {revisioningRAB && (
          <RABRevisionForm
            open={isRABRevisionModalOpen}
            projectId={revisioningRAB.id}
            projectName={revisioningRAB.name}
            onClose={() => {
              setIsRABRevisionModalOpen(false);
              setRevisioningRAB(null);
            }}
            onSaved={handleRABRevisionSaved}
          />
        )}
      </div>
    </div>
  );
}
