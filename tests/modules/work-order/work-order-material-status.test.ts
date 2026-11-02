import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ADMIN_MATERIAL_LOCKED_STATUSES,
  buildAdminMaterialLockedMessage,
  isAdminMaterialLocked,
} from "@/modules/work-order/domain/work-order-material-status";

describe("aturan status material admin work order", () => {
  it("mengunci status yang sama dengan mode read-only detail WO admin", () => {
    expect([...ADMIN_MATERIAL_LOCKED_STATUSES]).toEqual([
      "VERIFIED",
      "CLOSED",
      "CANCELLED",
    ]);
  });

  it.each(["VERIFIED", "CLOSED", "CANCELLED"])("%s terkunci", (status) => {
    expect(isAdminMaterialLocked(status)).toBe(true);
  });

  it.each([
    "PENDING",
    "REQUESTED",
    "ASSIGNED",
    "IN_PROGRESS",
    "ON_HOLD",
    "COMPLETED",
  ])("%s tidak terkunci", (status) => {
    expect(isAdminMaterialLocked(status)).toBe(false);
  });

  it("status kosong tidak dianggap terkunci", () => {
    expect(isAdminMaterialLocked(undefined)).toBe(false);
    expect(isAdminMaterialLocked(null)).toBe(false);
  });

  it("pesan penolakan menyebut status work order", () => {
    expect(buildAdminMaterialLockedMessage("CLOSED")).toContain("CLOSED");
  });

  it("detail WO admin memakai aturan bersama, bukan salinan daftar status", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/admin/workorders/[id]/WoDetailClient.tsx"),
      "utf8",
    );
    expect(source).toContain('from "@/modules/work-order/client"');
    expect(source).toMatch(/isReadOnly\s*=\s*isAdminMaterialLocked\(/);
    expect(source).not.toMatch(
      /\[\s*"VERIFIED",\s*"CLOSED",\s*"CANCELLED"\s*\]/,
    );
  });
});
