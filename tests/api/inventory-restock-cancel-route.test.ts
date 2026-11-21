import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  hasPermission: vi.fn(),
  ensureSiteAccess: vi.fn(),
  cancelRequest: vi.fn(),
  patchLifecycle: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError, warn: vi.fn(), logActivity: vi.fn() },
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
    cancelRestockRequest: mocks.cancelRequest,
    patchRestockRequestLifecycle: mocks.patchLifecycle,
    getRestockRequestDetail: vi.fn(),
    deleteRestockRequest: vi.fn(),
    getInventoryRouteService: vi.fn(() => ({})),
  };
});

import { PATCH } from "@/app/api/inventory/restock/requests/[id]/route";
import { RESTOCK_MESSAGES } from "@/modules/inventory/services/restock-messages";

function patch(body: unknown): Promise<NextResponse> {
  return PATCH(
    new NextRequest("http://localhost/api/inventory/restock/requests/pr-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "pr-1" }) },
  );
}

const validCancel = { action: "CANCEL", alasan: "  Tidak jadi dibutuhkan  " };

describe("PATCH /api/inventory/restock/requests/[id] — Batalkan Pengajuan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", tenantId: "tenant-1" },
    });
    mocks.hasPermission.mockResolvedValue(true);
    mocks.ensureSiteAccess.mockResolvedValue(null);
    mocks.cancelRequest.mockResolvedValue({
      success: true,
      data: { id: "pr-1", status: "CANCELLED" },
    });
  });

  it("membatalkan dengan alasan yang dirapikan dan menjawab pesan singkat", async () => {
    const response = await patch(validCancel);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { id: "pr-1", status: "CANCELLED" },
      message: "Pengajuan dibatalkan.",
    });
    expect(mocks.cancelRequest).toHaveBeenCalledWith({
      id: "pr-1",
      tenantId: "tenant-1",
      actorId: "user-1",
      alasan: "Tidak jadi dibutuhkan",
    });
    expect(mocks.patchLifecycle).not.toHaveBeenCalled();
  });

  it("memakai izin restock:verify, bukan izin persetujuan", async () => {
    mocks.hasPermission.mockImplementation(
      async (permission: string) => permission === "restock:verify",
    );

    const response = await patch(validCancel);

    expect(response.status).toBe(200);
    expect(mocks.hasPermission).toHaveBeenCalledWith("restock:verify");
    expect(mocks.hasPermission).not.toHaveBeenCalledWith("restock:approve");
  });

  it("menolak akun tanpa izin restock:verify walau boleh menyetujui", async () => {
    mocks.hasPermission.mockImplementation(
      async (permission: string) => permission !== "restock:verify",
    );

    const response = await patch(validCancel);

    expect(response.status).toBe(403);
    expect((await response.json()).error).toContain(
      "membatalkan pengajuan restock",
    );
    expect(mocks.cancelRequest).not.toHaveBeenCalled();
  });

  it("menolak pengajuan di site lain sebelum membaca isinya", async () => {
    mocks.ensureSiteAccess.mockResolvedValue(
      NextResponse.json(
        { error: RESTOCK_MESSAGES.requestBedaSite },
        { status: 403 },
      ),
    );

    const response = await patch(validCancel);

    expect(response.status).toBe(403);
    expect(mocks.ensureSiteAccess).toHaveBeenCalledWith({
      user: { id: "user-1", tenantId: "tenant-1" },
      purchaseRequestId: "pr-1",
      tenantId: "tenant-1",
    });
    expect(mocks.cancelRequest).not.toHaveBeenCalled();
  });

  it.each([
    [
      "alasan tidak diisi",
      { action: "CANCEL" },
      "Tulis alasan pembatalan, paling sedikit 5 huruf.",
    ],
    [
      "alasan terlalu pendek setelah dirapikan",
      { action: "CANCEL", alasan: "  abc  " },
      "Tulis alasan pembatalan, paling sedikit 5 huruf.",
    ],
    [
      "alasan terlalu panjang",
      { action: "CANCEL", alasan: "x".repeat(256) },
      "Alasan pembatalan terlalu panjang. Paling banyak 255 huruf.",
    ],
    [
      "ada field lain",
      { ...validCancel, items: [] },
      "Data yang dikirim tidak terbaca. Muat ulang halaman, lalu coba lagi.",
    ],
  ])("menjawab 400 bila %s", async (_label, body, message) => {
    const response = await patch(body);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(message);
    expect(mocks.cancelRequest).not.toHaveBeenCalled();
  });

  it.each([
    ["NOT_FOUND", 404, RESTOCK_MESSAGES.requestNotFound],
    [
      "CONFLICT",
      409,
      "Pengajuan ini sudah selesai, jadi tidak bisa dibatalkan.",
    ],
  ])("memetakan galat %s ke status %i", async (code, status, error) => {
    mocks.cancelRequest.mockResolvedValue({ success: false, code, error });

    const response = await patch(validCancel);

    expect(response.status).toBe(status);
    expect((await response.json()).error).toBe(error);
  });

  it("menjawab 500 dengan pesan gangguan bila service gagal tak terduga", async () => {
    mocks.cancelRequest.mockRejectedValue(new Error("db down"));

    const response = await patch(validCancel);

    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain("Membatalkan pengajuan");
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("menjawab 401 bila sesi sudah habis", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await patch(validCancel);

    expect(response.status).toBe(401);
    expect(mocks.cancelRequest).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/inventory/restock/requests/[id] — persetujuan tetap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", tenantId: "tenant-1" },
    });
    mocks.hasPermission.mockResolvedValue(true);
    mocks.ensureSiteAccess.mockResolvedValue(null);
  });

  it("Setujui tetap memakai izin restock:approve dan service persetujuan", async () => {
    mocks.patchLifecycle.mockResolvedValue({
      success: true,
      data: { id: "pr-1", status: "ORDERED" },
    });

    const response = await patch({
      action: "APPROVE",
      items: [{ itemId: "item-1", keputusan: "APPROVED", jumlah: 3 }],
    });

    expect(response.status).toBe(200);
    expect(mocks.hasPermission).toHaveBeenCalledWith("restock:approve");
    expect(mocks.patchLifecycle).toHaveBeenCalledTimes(1);
    expect(mocks.cancelRequest).not.toHaveBeenCalled();
  });

  it("tindakan yang tidak dikenal tetap dijawab pesan persetujuan", async () => {
    const response = await patch({ action: "SUBMIT" });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      "Tindakan ini tidak dikenal. Pilih Setujui atau Tolak, lalu coba lagi.",
    );
    expect(mocks.cancelRequest).not.toHaveBeenCalled();
  });
});
