import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readUsersDetailClient(): string {
  return readFileSync(
    resolve(process.cwd(), "app/admin/users/[id]/UsersDetailClient.tsx"),
    "utf8",
  );
}

function readLeaveBalanceRoute(): string {
  return readFileSync(
    resolve(process.cwd(), "app/api/admin/leave-balance/route.ts"),
    "utf8",
  );
}

describe("admin users edit safety", () => {
  it("sends attendance requirement changes in the user update payload", () => {
    const clientFile = readUsersDetailClient();
    const payloadStart = clientFile.indexOf(
      "const updateBody: Record<string, unknown> = {",
    );
    const requestIndex = clientFile.indexOf(
      "const userRes = await fetch(`/api/admin/users/${id}`, {",
    );

    expect(payloadStart).toBeGreaterThan(-1);
    expect(requestIndex).toBeGreaterThan(payloadStart);

    const payloadBlock = clientFile.slice(payloadStart, requestIndex);

    expect(payloadBlock).toContain(
      "isAttendanceRequired: formData.isAttendanceRequired,",
    );
  });

  it("allows leave quotas to be managed from the user management flow", () => {
    const clientFile = readUsersDetailClient();
    const routeFile = readLeaveBalanceRoute();

    expect(clientFile).toContain("const canViewLeaveQuotas");
    expect(clientFile).toContain("const canManageLeaveQuotas");
    expect(clientFile).toMatch(/hasPermission\((["'])users:read\1\)/);
    expect(clientFile).toMatch(/hasPermission\((["'])attendance:read\1\)/);
    expect(clientFile).toMatch(/hasPermission\((["'])attendance:update\1\)/);
    expect(clientFile).toContain("{canViewLeaveQuotas && (");
    expect(clientFile).toContain("{canManageLeaveQuotas && (");

    expect(routeFile).toMatch(
      /permissions:\s*\[\s*["']attendance:read["'],\s*["']attendance:update["'],\s*["']users:read["']\s*\]/,
    );
    expect(routeFile).toMatch(
      /permissions:\s*\[\s*["']attendance:update["'],\s*["']users:update["']\s*\]/,
    );
  });

  it("renders overtime inputs without any casts", () => {
    const clientFile = readUsersDetailClient();

    expect(clientFile).not.toContain(
      "(formData as any)[`overtimeCalcType${item.key}`]",
    );
    expect(clientFile).not.toContain(
      "(formData as any)[`overtimeRate${item.key}`]",
    );
  });
});
