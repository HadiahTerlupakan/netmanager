"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/LoadingSkeleton";
import PlanningFormClient from "../../PlanningFormClient";
import type { PlanningDetailDTO } from "@/modules/planning";

/**
 * Fetch planning detail, then render PlanningFormClient in edit mode
 * dengan initialData dari server.
 */
export default function PlanningEditClient({
  planningId,
}: {
  planningId: string;
}) {
  const [planning, setPlanning] = useState<PlanningDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/planning/${planningId}`)
      .then((res) => res.json())
      .then((data) => setPlanning(data.data ?? null))
      .catch(() => setPlanning(null))
      .finally(() => setLoading(false));
  }, [planningId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
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
        estimatedBudget: planning.estimatedBudget
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
