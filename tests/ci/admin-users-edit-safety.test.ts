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
    expect(clientFile).toContain("hasPermission('users:read')");
    expect(clientFile).toContain("hasPermission('attendance:read')");
    expect(clientFile).toContain("hasPermission('attendance:update')");
    expect(clientFile).toContain("{canViewLeaveQuotas && (");
    expect(clientFile).toContain("{canManageLeaveQuotas && (");

    expect(routeFile).toContain(
      "permissions: ['attendance:read', 'attendance:update', 'users:read']",
    );
    expect(routeFile).toContain(
      "permissions: ['attendance:update', 'users:update']",
    );
  });
});
