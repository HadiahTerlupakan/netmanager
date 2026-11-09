import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  hasPermission: vi.fn(),
  ensureSiteAccess: vi.fn(),
  voidPurchase: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    logActivity: vi.fn(),
  },
}));
vi.mock("@/app/api/inventory/restock/_lib/restock-site-access", () => ({
  ensureRestockRequestSiteAccess: mocks.ensureSiteAccess,
  ensureRestockGudangSiteAccess: vi.fn(),
}));
vi.mock("@/modules/inventory", async () => {
  const messages = await vi.importActual<
    typeof import("@/modules/inventory/services/restock-messages")
  >("@/modules/inventory/services/restock-messages");
  return {
    ...messages,
    createRestockPurchaseRecordService: vi.fn(() => ({
      voidPurchase: mocks.voidPurchase,
    })),
  };
});

import { POST } from "@/app/api/inventory/restock/requests/[id]/purchases/[recordId]/void/route";

function post(body: unknown) {
  return POST(
    new NextRequest(
      "http://localhost/api/inventory/restock/requests/pr-1/purchases/rec-1/void",
      {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
      },
    ),
    { params: Promise.resolve({ id: "pr-1", recordId: "rec-1" }) },
  );
}

describe("POST /api/inventory/restock/requests/[id]/purchases/[recordId]/void", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: {
        id: "user-1",
        name: "Sari",
        tenantId: "tenant-1",
        permissions: [],
      },
    });
    mocks.hasPermission.mockResolvedValue(true);
    mocks.ensureSiteAccess.mockResolvedValue(null);
  });

  it("403 tanpa izin restock:verify", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    const response = await post({ reason: "Salah catat" });

    expect(response.status).toBe(403);
    expect(mocks.hasPermission).toHaveBeenCalledWith("restock:verify");
    expect(mocks.voidPurchase).not.toHaveBeenCalled();
  });

  it("menghormati batas site pengajuan", async () => {
    mocks.ensureSiteAccess.mockResolvedValue(
      new Response(null, { status: 403 }),
    );

    const response = await post({ reason: "Salah catat" });

    expect(response.status).toBe(403);
    expect(mocks.voidPurchase).not.toHaveBeenCalled();
  });

  it.each([
    [{}, "Tulis alasan pembatalan."],
    [{ reason: "   ab " }, "Alasan pembatalan minimal 5 huruf."],
    [{ reason: "x".repeat(501) }, "Alasan pembatalan paling banyak 500 huruf."],
  ])("400 untuk alasan tidak sah %j", async (body, message) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain(message);
    expect(mocks.voidPurchase).not.toHaveBeenCalled();
  });

  it("meneruskan pembatalan dengan pelaku & tenant dari sesi", async () => {
    mocks.voidPurchase.mockResolvedValue({
      success: true,
      data: { record: { id: "rec-1" }, message: "Catatan belanja dibatalkan." },
    });

    const response = await post({ reason: "  Bukan belanja kita " });

    expect(response.status).toBe(200);
    expect(mocks.voidPurchase).toHaveBeenCalledWith({
      purchaseRequestId: "pr-1",
      recordId: "rec-1",
      tenantId: "tenant-1",
      actorId: "user-1",
      reason: "Bukan belanja kita",
    });
    expect(await response.json()).toEqual({
      data: { id: "rec-1" },
      message: "Catatan belanja dibatalkan.",
    });
  });

  it.each([
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
  ])("%s → %i", async (code, status) => {
    mocks.voidPurchase.mockResolvedValue({
      success: false,
      code,
      error: "pesan",
    });

    const response = await post({ reason: "Salah catat toko" });

    expect(response.status).toBe(status);
  });

  it("500 dengan pesan awam bila ada galat tak terduga", async () => {
    mocks.voidPurchase.mockRejectedValue(new Error("db mati"));

    const response = await post({ reason: "Salah catat toko" });

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("db mati");
    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
