import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A plain class method stands in for the service: a vi.fn that throws gets
// reported by Vitest as the test's own failure even though the route
// catches it.
const service = vi.hoisted(() => ({
  currentPassword: "lama123",
  calls: [] as string[][],
}));

vi.mock("@/lib/customer-auth", () => ({
  requireCustomerAuth: async () => ({ session: { id: "p1" } }),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info() {}, error() {}, warn() {} },
}));
vi.mock("@/modules/pelanggan", () => ({
  CustomerPortalService: class {
    async changePassword(id: string, current: string, next: string) {
      service.calls.push([id, current, next]);
      if (current !== service.currentPassword) {
        throw new Error("Password saat ini salah");
      }
      return {};
    }
  },
}));

import { PATCH } from "@/app/api/customer/profile/route";

const patch = (body: unknown) =>
  PATCH(
    new NextRequest("http://localhost/api/customer/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );

describe("PATCH /api/customer/profile password change", () => {
  beforeEach(() => {
    service.calls = [];
  });

  // The mobile app treats every 401 as an expired session and logs the
  // customer out, so a mistyped current password must not answer 401.
  it("answers a wrong current password with 400, not 401", async () => {
    const res = await patch({
      currentPassword: "salah",
      newPassword: "baru123",
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      success: false,
      error: "Password saat ini salah",
    });
  });

  it("changes the password when the current one is right", async () => {
    const res = await patch({
      currentPassword: "lama123",
      newPassword: "baru123",
    });

    expect(res.status).toBe(200);
    expect(service.calls).toEqual([["p1", "lama123", "baru123"]]);
  });
});
