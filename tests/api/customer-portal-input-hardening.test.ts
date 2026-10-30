import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Plain functions stand in for the services: a vi.fn that throws is reported
// by Vitest as the test's own failure even when the route catches it.
const state = vi.hoisted(() => ({
  notificationLimits: [] as number[],
  profileUpdates: [] as unknown[],
  profileError: null as Error | null,
}));

vi.mock("@/lib/customer-auth", () => ({
  requireCustomerAuth: async () => ({ session: { id: "p1" } }),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info() {}, error() {}, warn() {} },
}));
vi.mock("@/modules/notification", () => ({
  announcementService: {
    getAnnouncements: async () => [
      {
        id: "a1",
        title: "Pemeliharaan jaringan",
        content: "Sabtu 01.00–03.00",
        isPinned: true,
        target: "CUSTOMER",
        startDate: null as Date | null,
        endDate: null as Date | null,
        createdAt: new Date("2026-10-30T01:00:00.000Z"),
        updatedAt: new Date("2026-10-30T01:00:00.000Z"),
        isActive: true,
        createdBy: "admin-7",
        tenantId: "tenant-a",
        user: { id: "admin-7", name: "Admin", email: "admin@isp.id" },
        _count: { reads: 41 },
      },
    ],
  },
}));
vi.mock("@/modules/pelanggan", () => ({
  getCustomerNotificationService: () => ({
    async getNotifications(_id: string, limit: number) {
      state.notificationLimits.push(limit);
      return { notifications: [] as unknown[], unreadCount: 0 };
    },
  }),
  CustomerPortalService: class {
    async updateProfile(_id: string, data: unknown) {
      if (state.profileError) throw state.profileError;
      state.profileUpdates.push(data);
      return { noTelp: "081234567890", updatedAt: new Date() };
    }
    async changePassword() {
      return {};
    }
  },
  CustomerPackageUpgradeError: class extends Error {},
  getCustomerPackageUpgradeService: () => ({
    async requestUpgrade() {
      return {};
    },
  }),
}));

import { GET as getAnnouncements } from "@/app/api/customer/announcements/route";
import { GET as getNotifications } from "@/app/api/customer/notifications/route";
import { POST as requestUpgrade } from "@/app/api/customer/package/upgrade/route";
import { PATCH as patchProfile } from "@/app/api/customer/profile/route";

const url = (path: string) => `http://localhost/api/customer${path}`;

beforeEach(() => {
  state.notificationLimits = [];
  state.profileUpdates = [];
  state.profileError = null;
});

describe("GET /api/customer/notifications limit", () => {
  it.each([
    ["missing", "", 10],
    ["not a number", "?limit=abc", 10],
    ["zero", "?limit=0", 1],
    ["huge", "?limit=100000", 50],
    ["ordinary", "?limit=20", 20],
  ])("bounds a %s limit", async (_label, query, expected) => {
    await getNotifications(new NextRequest(url(`/notifications${query}`)));

    expect(state.notificationLimits).toEqual([expected]);
  });
});

describe("GET /api/customer/announcements", () => {
  // The raw row carried who wrote it, the tenant and the read count.
  it("sends customers only what the announcement says", async () => {
    const res = await getAnnouncements(new NextRequest(url("/announcements")));
    const [announcement] = await res.json();

    expect(announcement).toEqual({
      id: "a1",
      title: "Pemeliharaan jaringan",
      content: "Sabtu 01.00–03.00",
      isPinned: true,
      target: "CUSTOMER",
      startDate: null,
      endDate: null,
      createdAt: "2026-10-30T01:00:00.000Z",
    });
  });
});

describe("PATCH /api/customer/profile", () => {
  const patch = (body: unknown) =>
    patchProfile(
      new NextRequest(url("/profile"), {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    );

  it.each(["", "abc", "0812", "+62 812 3456 7890 1234 5"])(
    "refuses %j as a phone number",
    async (noTelp) => {
      const res = await patch({ noTelp });

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        error: "Nomor telepon tidak valid",
      });
      expect(state.profileUpdates).toEqual([]);
    },
  );

  it.each(["081234567890", "+62 812-3456-7890"])(
    "accepts %j",
    async (noTelp) => {
      const res = await patch({ noTelp });

      expect(res.status).toBe(200);
      expect(state.profileUpdates).toEqual([{ noTelp }]);
    },
  );

  it("does not pass an internal error message to the customer", async () => {
    state.profileError = new Error("connect ECONNREFUSED db-billing:5432");

    const res = await patch({ isPromoEnabled: true });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Terjadi kesalahan server");
  });
});

describe("POST /api/customer/package/upgrade", () => {
  it("answers a malformed body with 400, not 500", async () => {
    const res = await requestUpgrade(
      new NextRequest(url("/package/upgrade"), {
        method: "POST",
        body: "{bukan json",
      }),
    );

    expect(res.status).toBe(400);
  });
});
