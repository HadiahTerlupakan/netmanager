"use client";

import { useState, useMemo, type DragEvent } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { useApi } from "@/lib/hooks/useApi";
import { usePermission } from "@/hooks/use-permission";
import { Skeleton } from "@/components/ui/LoadingSkeleton";
import {
  KANBAN_COLUMN_LABELS,
  PLANNING_STATUS_CONFIG,
  formatBudget,
  formatDateShort,
} from "@/modules/planning/client";
import type { PlanningKanbanBoardDTO } from "@/modules/planning/client";
import type { PlanningStatus } from "@/modules/planning/client";
import { resolveKanbanTransition } from "@/modules/planning/client";

/**
 * Papan kanban dengan native HTML5 Drag & Drop.
 *
 * Menyeret kartu MEMINDAHKAN statusnya. Hanya transisi yang tidak memerlukan
 * masukan tambahan yang bisa dilakukan lewat seret — lihat
 * `resolveKanbanTransition`. Persetujuan dan penolakan sengaja tidak termasuk:
 * keduanya keputusan kendali yang harus disengaja, dan penolakan wajib beralasan.
 *
 * Sebelumnya kartu bisa diseret tetapi tidak ada handler drop sama sekali,
 * sehingga gestur itu tidak melakukan apa pun — antarmuka menjanjikan sesuatu
 * yang tidak ditepatinya.
 *
 * ponytail: native HTML5 DnD dipakai bukan @dnd-kit. Upgrade ke @dnd-kit
 * saat butuh: touch device support, custom drag preview, multi-container sort.
 */
export default function PlanningKanbanClient() {
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission("planning:update");

  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingFrom, setDraggingFrom] = useState<PlanningStatus | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    return `/api/planning/kanban?${params.toString()}`;
  }, [search]);

  const {
    data: board,
    isLoading,
    mutate,
  } = useApi<PlanningKanbanBoardDTO>(url, {
    onError: () => toast.error("Gagal memuat kanban board"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  const columns = board?.columns ?? [];

  const handleDragStart = (
    e: DragEvent,
    cardId: string,
    from: PlanningStatus,
  ) => {
    setDraggingId(cardId);
    setDraggingFrom(from);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", cardId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDraggingFrom(null);
  };

  const handleDrop = async (e: DragEvent, to: PlanningStatus) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("text/plain");
    const transition =
      draggingFrom && resolveKanbanTransition(draggingFrom, to);

    handleDragEnd();
    if (!cardId || !transition) return;

    setMovingId(cardId);
    try {
      const res = await fetch(
        `/api/planning/${cardId}/${transition.endpoint}`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Gagal memindahkan planning");
      }
      toast.success(transition.label);
      await mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memindahkan planning",
      );
    } finally {
      setMovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Papan perencanaan
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {board?.totalCards ?? 0} rencana ·{" "}
            {canUpdate
              ? "klik untuk membuka, seret untuk memindahkan tahap"
              : "klik untuk membuka"}
          </p>
        </div>
        <div className="relative w-64">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari planning..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => {
          const statusConfig =
            PLANNING_STATUS_CONFIG[column.status as PlanningStatus];
          // Kolom hanya menyala bila kartu yang sedang diseret memang boleh
          // pindah ke sini — supaya tujuan yang sah terlihat sebelum dilepas.
          const isDropTarget = Boolean(
            draggingFrom &&
            resolveKanbanTransition(
              draggingFrom,
              column.status as PlanningStatus,
            ),
          );
          return (
            <div
              key={column.status}
              onDragOver={(e) => {
                if (!isDropTarget) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => handleDrop(e, column.status as PlanningStatus)}
              className={`flex-shrink-0 w-72 rounded-xl border flex flex-col max-h-[calc(100vh-200px)] transition-colors ${
                isDropTarget
                  ? "border-indigo-400 bg-indigo-50/70 dark:border-indigo-500 dark:bg-indigo-950/30"
                  : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
              }`}
            >
              {/* Column header */}
              <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${statusConfig.dot}`}
                  />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {KANBAN_COLUMN_LABELS[column.status as PlanningStatus] ??
                      column.label}
                  </span>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                  {column.count}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-32">
                {column.cards.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8 px-3">
                    {isDropTarget
                      ? "Lepas di sini untuk memindahkan"
                      : "Belum ada rencana di tahap ini"}
                  </p>
                ) : (
                  column.cards.map((card) => (
                    <Link
                      key={card.id}
                      href={`/admin/planning/${card.id}`}
                      draggable={canUpdate}
                      onDragStart={(e) =>
                        handleDragStart(
                          e,
                          card.id,
                          column.status as PlanningStatus,
                        )
                      }
                      onDragEnd={handleDragEnd}
                      className={`block p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all cursor-pointer ${
                        draggingId === card.id || movingId === card.id
                          ? "opacity-40 pointer-events-none"
                          : ""
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                        {card.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {card.area}
                      </p>
                      <div className="flex items-center justify-between mt-2.5 text-xs">
                        <span className="text-gray-600 dark:text-gray-300">
                          {formatBudget(card.estimatedBudget)}
                        </span>
                        <span className="text-gray-400">
                          {card.milestonesCount > 0 &&
                            `${card.completedMilestonesCount}/${card.milestonesCount}`}
                        </span>
                      </div>
                      {card.progressPercentage > 0 && (
                        <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{
                              width: `${card.progressPercentage}%`,
                            }}
                          />
                        </div>
                      )}
                      {card.targetCompletionDate && (
                        <p className="text-xs text-gray-400 mt-1.5">
                          Target: {formatDateShort(card.targetCompletionDate)}
                        </p>
                      )}
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
