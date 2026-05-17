"use client";
import { clientLogger } from "@/lib/client-logger";

import { useState, useCallback } from "react";
import { useRealtime } from "@/lib/realtime/RealtimeContext";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";
import { type WorkOrderActivityPayload } from "../types";

export interface ActivityItem {
  id: string;
  type: "comment" | "update" | "attachment";
  message?: string;
  updateType?: string;
  createdAt: string;
  createdBy?: {
    id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  } | null;
  attachment?: {
    id: string;
    fileName: string;
    filePath: string;
    fileType: string;
    caption?: string | null;
  } | null;
}

interface UseRealtimeWorkOrderActivityOptions {
  workOrderId: string;
  initialActivities?: ActivityItem[];
}

interface UseRealtimeWorkOrderActivityResult {
  activities: ActivityItem[];
  isConnected: boolean;
  addActivity: (activity: ActivityItem) => void;
  setActivities: (activities: ActivityItem[]) => void;
}

/**
 * Hook for real-time Work Order Activity Timeline with WebSocket
 * Listens for new comments, updates, and attachments and updates the timeline instantly
 */
export function useRealtimeWorkOrderActivity(
  options: UseRealtimeWorkOrderActivityOptions,
): UseRealtimeWorkOrderActivityResult {
  const { workOrderId, initialActivities = [] } = options;
  const { isConnected } = useRealtime();

  const [activities, setActivities] =
    useState<ActivityItem[]>(initialActivities);

  // Update activities when initial data changes (pattern C: render-time prev comparator)
  const [prevInitialActivities, setPrevInitialActivities] =
    useState(initialActivities);
  if (
    initialActivities !== prevInitialActivities &&
    initialActivities.length > 0
  ) {
    setPrevInitialActivities(initialActivities);
    setActivities(initialActivities);
  } else if (initialActivities !== prevInitialActivities) {
    setPrevInitialActivities(initialActivities);
  }

  useRealtimeScope(workOrderId ? { kind: "workorder", id: workOrderId } : null);

  // Handle new activity from WebSocket
  const handleNewActivity = useCallback(
    (payload: WorkOrderActivityPayload) => {
      // Only process if it's for this work order
      if (payload.workOrderId !== workOrderId) return;

      clientLogger.info(
        "[WorkOrderActivity] New activity received:",
        payload.activity.type,
      );

      // Add new activity to the list (avoid duplicates), insert at beginning (newest first)
      setActivities((prev) => {
        const exists = prev.some((a) => a.id === payload.activity.id);
        if (exists) return prev;
        return [payload.activity, ...prev];
      });
    },
    [workOrderId],
  );

  useRealtimeEvent<WorkOrderActivityPayload>(
    "workorder.activity",
    handleNewActivity,
  );

  // Manually add an activity (for optimistic updates after sending)
  const addActivity = useCallback((activity: ActivityItem) => {
    setActivities((prev) => {
      const exists = prev.some((a) => a.id === activity.id);
      if (exists) return prev;
      return [activity, ...prev];
    });
  }, []);

  return {
    activities,
    isConnected,
    addActivity,
    setActivities,
  };
}
