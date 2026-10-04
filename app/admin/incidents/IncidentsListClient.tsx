"use client";

import { useState } from "react";
import { HiOutlinePlus } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import PageLoader from "@/components/ui/PageLoader";
import { usePermission } from "@/hooks/use-permission";
import { useApi } from "@/lib/hooks/useApi";
import { CreateIncidentModal } from "./CreateIncidentModal";
import { IncidentListItem, type IncidentRow } from "./IncidentListItem";
import { IncidentMetricsCards } from "./IncidentMetricsCards";

type IncidentFilter = "ACTIVE" | "RESOLVED" | "all";

const FILTER_OPTIONS: ReadonlyArray<{ value: IncidentFilter; label: string }> = [
  { value: "ACTIVE", label: "Berlangsung" },
  { value: "RESOLVED", label: "Selesai" },
  { value: "all", label: "Semua" },
];

function incidentsUrl(filter: IncidentFilter): string {
  return filter === "all" ? "/api/admin/incidents" : `/api/admin/incidents?status=${filter}`;
}

/** Halaman daftar insiden: metrik, filter status, dan pencatatan insiden baru lewat modal. */
export function IncidentsListClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("incidents:create");

  const [filter, setFilter] = useState<IncidentFilter>("ACTIVE");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: incidents, isLoading, mutate } = useApi<IncidentRow[]>(incidentsUrl(filter));

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Insiden</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pencatatan dan pemantauan gangguan layanan; insiden publik tampil di halaman status.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <HiOutlinePlus className="h-4 w-4" />
            Insiden Baru
          </Button>
        )}
      </div>

      <IncidentMetricsCards />

      <div className="flex gap-2" role="tablist" aria-label="Filter status insiden">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              filter === option.value
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-3">
          {(incidents ?? []).map((incident) => (
            <IncidentListItem key={incident.id} incident={incident} />
          ))}
          {!incidents?.length && (
            <div className="rounded-lg bg-white py-12 text-center text-sm text-gray-500 dark:bg-gray-800">
              Tidak ada insiden untuk filter ini.
            </div>
          )}
        </div>
      )}

      {isCreateOpen && (
        <CreateIncidentModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false);
            void mutate();
          }}
        />
      )}
    </div>
  );
}
