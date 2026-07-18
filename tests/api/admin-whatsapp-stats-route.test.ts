import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVerifyAuth = vi.fn();
const mockHasPermission = vi.fn();
const mockAccountFindById = vi.fn();
const mockGetGlobalStats = vi.fn();

vi.mock("@/lib/auth", () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock("@/lib/api", () => ({
  ApiErrors: {
    unauthorized: () =>
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    forbidden: () =>
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    internalError: () =>
      new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
      }),
  },
}));

vi.mock("@/modules/notification", () => ({
  WhatsAppSenderService: class {
    getGlobalStats = (...args: unknown[]) => mockGetGlobalStats(...args);
  },
  WhatsAppAccountService: class {
    findById = (...args: unknown[]) => mockAccountFindById(...args);
  },
}));

import { GET } from "@/app/api/admin/whatsapp/stats/route";

describe("GET /api/admin/whatsapp/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({
      user: { id: "u-1", role: "ADMIN" },
      tenantId: "tenant-1",
    });
    mockHasPermission.mockResolvedValue(true);
  });

  it("Given accountId milik tenant lain When stats Then return 404", async () => {
    mockAccountFindById.mockResolvedValue(null);

    const req = new NextRequest(
      "http://localhost/api/admin/whatsapp/stats?accountId=wa-cross-tenant",
    );
    const res = await GET(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Akun tidak ditemukan");
    expect(mockAccountFindById).toHaveBeenCalledWith(
      "wa-cross-tenant",
      "tenant-1",
    );
    expect(mockGetGlobalStats).not.toHaveBeenCalled();
  });

  it("Given accountId milik tenant sendiri When stats Then return 200 dan data stats", async () => {
    mockAccountFindById.mockResolvedValue({ id: "wa-1", tenantId: "tenant-1" });
    mockGetGlobalStats.mockResolvedValue({
      total: 10,
      sent: 8,
      failed: 1,
      pending: 1,
    });

    const req = new NextRequest(
      "http://localhost/api/admin/whatsapp/stats?accountId=wa-1",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ total: 10, sent: 8, failed: 1, pending: 1 });
    expect(mockAccountFindById).toHaveBeenCalledWith("wa-1", "tenant-1");
    expect(mockGetGlobalStats).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        accountId: "wa-1",
      }),
    );
  });

  it("Given accountId tidak diberikan When stats Then return 200 global stats", async () => {
    mockGetGlobalStats.mockResolvedValue({
      total: 25,
      sent: 20,
      failed: 3,
      pending: 2,
    });

    const req = new NextRequest("http://localhost/api/admin/whatsapp/stats");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ total: 25, sent: 20, failed: 3, pending: 2 });
    expect(mockAccountFindById).not.toHaveBeenCalled();
    expect(mockGetGlobalStats).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        accountId: undefined,
      }),
    );
  });
});
