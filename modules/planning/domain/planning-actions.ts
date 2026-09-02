import type { PlanningStatus } from "./entities/PlanningEntity";

export interface PlanningPermissions {
  canUpdate: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canDelete: boolean;
}

export interface PlanningActions {
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canStart: boolean;
  canComplete: boolean;
  canRecordProgress: boolean;
  canDelete: boolean;
}

/**
 * Menentukan aksi apa saja yang tersedia untuk sebuah rencana.
 *
 * Sebelumnya logika ini tersebar inline di komponen detail dan tidak teruji,
 * sehingga menyimpang dari aturan domain tanpa ketahuan: tombol Ajukan hanya
 * muncul saat BACKLOG padahal `canBeSubmitted()` juga mengizinkan REJECTED —
 * rencana yang ditolak bisa diperbaiki tetapi tidak pernah bisa diajukan ulang.
 *
 * Disatukan di sini supaya halaman mana pun menampilkan aksi yang sama, dan
 * supaya aturannya bisa diuji tanpa merender komponen.
 */
export function resolvePlanningActions(
  status: PlanningStatus,
  permissions: PlanningPermissions,
): PlanningActions {
  const isDraft = status === "BACKLOG" || status === "REJECTED";
  const isAwaitingApproval =
    status === "PENDING_APPROVAL" || status === "APPROVED_LEVEL1";

  return {
    canEdit: permissions.canUpdate && isDraft,
    canSubmit: permissions.canSubmit && isDraft,
    canApprove: permissions.canApprove && isAwaitingApproval,
    canReject: permissions.canApprove && isAwaitingApproval,
    canStart: permissions.canUpdate && status === "APPROVED",
    canComplete: permissions.canUpdate && status === "IN_PROGRESS",
    canRecordProgress: permissions.canUpdate && status === "IN_PROGRESS",
    canDelete: permissions.canDelete && status === "BACKLOG",
  };
}
