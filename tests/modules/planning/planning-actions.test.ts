import { describe, expect, it } from "vitest";
import { resolvePlanningActions } from "@/modules/planning/client";
import type { PlanningStatus } from "@/modules/planning/domain/entities/PlanningEntity";

const allPermissions = {
  canUpdate: true,
  canSubmit: true,
  canApprove: true,
  canDelete: true,
};

const actionsFor = (status: PlanningStatus, perms = allPermissions) =>
  resolvePlanningActions(status, perms);

describe("resolvePlanningActions", () => {
  // Regresi: UI hanya menampilkan tombol Ajukan saat BACKLOG, padahal
  // canBeSubmitted() di domain mengizinkan REJECTED juga. Akibatnya rencana
  // yang ditolak bisa diperbaiki tetapi tidak pernah bisa diajukan ulang.
  it("mengizinkan pengajuan ulang setelah ditolak", () => {
    expect(actionsFor("REJECTED").canSubmit).toBe(true);
  });

  it("mengizinkan pengajuan dari backlog", () => {
    expect(actionsFor("BACKLOG").canSubmit).toBe(true);
  });

  it.each(["PENDING_APPROVAL", "APPROVED", "IN_PROGRESS"] as PlanningStatus[])(
    "menyembunyikan pengajuan saat %s",
    (status) => {
      expect(actionsFor(status).canSubmit).toBe(false);
    },
  );

  // Transisi pelaksanaan baru punya endpoint tetapi belum punya tombol.
  it("menampilkan aksi mulai hanya saat sudah disetujui", () => {
    expect(actionsFor("APPROVED").canStart).toBe(true);
    expect(actionsFor("IN_PROGRESS").canStart).toBe(false);
    expect(actionsFor("BACKLOG").canStart).toBe(false);
  });

  it("menampilkan aksi selesai hanya saat sedang berjalan", () => {
    expect(actionsFor("IN_PROGRESS").canComplete).toBe(true);
    expect(actionsFor("APPROVED").canComplete).toBe(false);
    expect(actionsFor("COMPLETED").canComplete).toBe(false);
  });

  it.each(["BACKLOG", "REJECTED"] as PlanningStatus[])(
    "mengizinkan edit rencana saat %s",
    (status) => {
      expect(actionsFor(status).canEdit).toBe(true);
    },
  );

  it("mengizinkan pencatatan realisasi hanya saat berjalan", () => {
    expect(actionsFor("IN_PROGRESS").canRecordProgress).toBe(true);
    expect(actionsFor("APPROVED").canRecordProgress).toBe(false);
  });

  it.each(["PENDING_APPROVAL", "APPROVED_LEVEL1"] as PlanningStatus[])(
    "menampilkan persetujuan saat %s",
    (status) => {
      expect(actionsFor(status).canApprove).toBe(true);
      expect(actionsFor(status).canReject).toBe(true);
    },
  );

  // Tanpa izin, tidak ada aksi yang muncul betapa pun statusnya mengizinkan.
  it("menghormati izin pengguna", () => {
    const noPermissions = {
      canUpdate: false,
      canSubmit: false,
      canApprove: false,
      canDelete: false,
    };
    const actions = actionsFor("BACKLOG", noPermissions);

    expect(actions.canEdit).toBe(false);
    expect(actions.canSubmit).toBe(false);
    expect(actions.canDelete).toBe(false);
  });

  it("membatasi hapus pada rencana yang belum diajukan", () => {
    expect(actionsFor("BACKLOG").canDelete).toBe(true);
    expect(actionsFor("APPROVED").canDelete).toBe(false);
  });
});
