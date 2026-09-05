"use client";

import { useApi } from "@/lib/hooks/useApi";
import { Skeleton } from "@/components/ui/LoadingSkeleton";
import PlanningFormClient from "../../PlanningFormClient";
import type { PlanningDetailDTO } from "@/modules/planning/client";

/**
 * Memuat detail rencana, lalu merender form dalam mode edit.
 *
 * Memakai `useApi` (TanStack Query), bukan `useEffect + fetch + useState`
 * seperti sebelumnya. Selain melanggar `docs/standards/data-fetching.md`, pola
 * lama punya dua cacat nyata: ia tidak memeriksa `res.ok`, sehingga respons
 * 403 atau 500 menghasilkan `data.data === undefined` dan halaman menampilkan
 * "Planning tidak ditemukan" untuk rencana yang sebenarnya ada; dan ia tidak
 * berbagi cache dengan halaman detail, sehingga menekan Edit dari detail
 * selalu memuat ulang dari nol meski datanya baru saja diambil.
 */
export default function PlanningEditClient({
  planningId,
}: {
  planningId: string;
}) {
  const {
    data: planning,
    error,
    isLoading,
  } = useApi<PlanningDetailDTO>(`/api/planning/${planningId}`);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Gagal memuat dibedakan dari tidak ditemukan: keduanya dulu tampil sebagai
  // "Planning tidak ditemukan", menyembunyikan gangguan jaringan atau server
  // sebagai data yang seolah tidak ada.
  if (error) {
    return (
      <p className="text-center py-12 text-gray-500 dark:text-gray-400">
        Gagal memuat planning: {error.message}
      </p>
    );
  }

  if (!planning) {
    return (
      <p className="text-center py-12 text-gray-500 dark:text-gray-400">
        Planning tidak ditemukan
      </p>
    );
  }

  return (
    <PlanningFormClient
      mode="edit"
      planningId={planningId}
      initialData={{
        title: planning.title,
        description: planning.description ?? "",
        area: planning.area,
        estimatedUnits: String(planning.estimatedUnits),
        estimatedBudget:
          planning.estimatedBudget !== null
            ? String(planning.estimatedBudget)
            : "",
        startDate: planning.startDate ? planning.startDate.split("T")[0] : "",
        targetCompletionDate: planning.targetCompletionDate
          ? planning.targetCompletionDate.split("T")[0]
          : "",
        coordinates: planning.coordinates,
      }}
    />
  );
}
