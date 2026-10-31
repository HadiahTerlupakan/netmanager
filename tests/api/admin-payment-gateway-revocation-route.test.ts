import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  getTenantIdFromContext: vi.fn(),
  setGatewayConfigRevoked: vi.fn(),
  logActivitySafe: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-response")>(
      "@/lib/api-response",
    );
  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
  };
});

vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: mocks.getTenantIdFromContext,
}));
vi.mock("@/lib/logger", () => ({
  logActivitySafe: mocks.logActivitySafe,
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/modules/payment-gateway", () => ({
  setGatewayConfigRevoked: mocks.setGatewayConfigRevoked,
}));

import { PUT } from "@/app/api/admin/payment-gateway/configs/[provider]/revocation/route";

const ctx = (provider = "DUITKU") =>
  ({ session: { user: { id: "admin-1" } }, params: { provider } }) as never;

const request = (body: unknown) =>
  new NextRequest(
    "http://localhost/api/admin/payment-gateway/configs/DUITKU/revocation",
    { method: "PUT", body: JSON.stringify(body) },
  );

const put = async (body: unknown, provider?: string) =>
  (await PUT(request(body), ctx(provider))) as NextResponse;

/**
 * Sakelar darurat konfigurasi gateway (mis. kredensial bocor): yang dicabut
 * menolak checkout baru, callback, dan cek status. Dulu hanya bisa diubah
 * langsung di database billing.
 */
describe("PUT /api/admin/payment-gateway/configs/[provider]/revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasPermission.mockResolvedValue(true);
    mocks.getTenantIdFromContext.mockResolvedValue({ tenantId: "tenant-1" });
    mocks.setGatewayConfigRevoked.mockImplementation(
      async (input: { provider: string; isRevoked: boolean }) => ({
        id: "cfg-1",
        provider: input.provider,
        isRevoked: input.isRevoked,
      }),
    );
  });

  it("mencabut konfigurasi provider milik tenant admin dan mencatatnya", async () => {
    const response = await put({ isRevoked: true });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      id: "cfg-1",
      provider: "DUITKU",
      isRevoked: true,
    });
    expect(mocks.hasPermission).toHaveBeenCalledWith("payment_gateway:update");
    expect(mocks.setGatewayConfigRevoked).toHaveBeenCalledWith({
      provider: "DUITKU",
      tenantId: "tenant-1",
      isRevoked: true,
    });
    expect(mocks.logActivitySafe).toHaveBeenCalledWith({
      action: "REVOKE",
      subject: "Payment Gateway Config",
      userId: "admin-1",
      tenantId: "tenant-1",
      details: { id: "cfg-1", provider: "DUITKU", isRevoked: true },
    });
  });

  it("memulihkan konfigurasi yang dicabut", async () => {
    const response = await put({ isRevoked: false });

    expect(response.status).toBe(200);
    expect(mocks.logActivitySafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "RESTORE",
        details: { id: "cfg-1", provider: "DUITKU", isRevoked: false },
      }),
    );
  });

  it("tanpa izin payment_gateway:update: 403 tanpa perubahan", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    const response = await put({ isRevoked: true });

    expect(response.status).toBe(403);
    expect(mocks.setGatewayConfigRevoked).not.toHaveBeenCalled();
    expect(mocks.logActivitySafe).not.toHaveBeenCalled();
  });

  it.each([[{}], [{ isRevoked: "true" }], [null]])(
    "badan %j ditolak 400",
    async (body) => {
      const response = await put(body);

      expect(response.status).toBe(400);
      expect(mocks.setGatewayConfigRevoked).not.toHaveBeenCalled();
    },
  );

  it("tanpa tenant: 400", async () => {
    mocks.getTenantIdFromContext.mockResolvedValue({ isSuperAdmin: true });

    const response = await put({ isRevoked: true });

    expect(response.status).toBe(400);
    expect(mocks.setGatewayConfigRevoked).not.toHaveBeenCalled();
  });

  it("tenant tanpa konfigurasi provider itu: 404 tanpa catatan", async () => {
    mocks.setGatewayConfigRevoked.mockResolvedValue(null);

    const response = await put({ isRevoked: true }, "TRIPAY");

    expect(response.status).toBe(404);
    expect(mocks.logActivitySafe).not.toHaveBeenCalled();
  });
});
