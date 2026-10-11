import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAuth: mockFns.requireAuth,
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
  ensurePermission: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logActivity: vi.fn(),
    logActivitySafe: vi.fn(),
  },
}));

import { PUT } from "@/app/api/announcements/[id]/route";

const PARAMS = { params: Promise.resolve({ id: "ann-1" }) };
const MULAI_TERSIMPAN = new Date("2026-10-09T00:00:00.000Z");
const BERAKHIR_TERSIMPAN = new Date("2026-10-16T00:00:00.000Z");

function permintaan(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/announcements/ann-1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Tes ini sengaja lewat route, bukan memanggil service langsung: bug yang
 * ditemukan di QA justru lahir di antara Zod dan service — transform schema
 * mengubah field yang tidak dikirim menjadi null, sehingga service tidak
 * pernah melihat `undefined`.
 */
describe("PUT /api/announcements/[id] — periode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.requireAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFns.hasPermission.mockResolvedValue(true);
    prismaMock.announcement.findUnique.mockResolvedValue({
      id: "ann-1",
      title: "Judul",
      content: "Konten",
      target: "ALL",
      isActive: true,
      isPinned: false,
      startDate: MULAI_TERSIMPAN,
      endDate: BERAKHIR_TERSIMPAN,
    } as never);
    prismaMock.announcement.update.mockResolvedValue({ id: "ann-1" } as never);
  });

  it("tidak menghapus tanggal tersimpan ketika payload tidak menyebutnya", async () => {
    const response = await PUT(permintaan({ title: "Judul baru" }), PARAMS);

    expect(response.status).toBe(200);
    const data = prismaMock.announcement.update.mock.calls[0]?.[0]
      ?.data as Record<string, unknown>;
    expect(data).not.toHaveProperty("startDate");
    expect(data).not.toHaveProperty("endDate");
  });

  it("tetap bisa mengosongkan tanggal ketika null dikirim eksplisit", async () => {
    await PUT(permintaan({ endDate: null }), PARAMS);

    const data = prismaMock.announcement.update.mock.calls[0]?.[0]
      ?.data as Record<string, unknown>;
    expect(data.endDate).toBeNull();
    expect(data).not.toHaveProperty("startDate");
  });

  it("menolak 400 saat tanggal berakhir mendahului tanggal mulai tersimpan", async () => {
    const response = await PUT(
      permintaan({ endDate: "2026-10-01T00:00:00.000Z" }),
      PARAMS,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Tanggal berakhir harus setelah tanggal mulai");
    expect(prismaMock.announcement.update).not.toHaveBeenCalled();
  });

  it("menolak 400 saat tanggal mulai melewati tanggal berakhir tersimpan", async () => {
    const response = await PUT(
      permintaan({ startDate: "2026-11-30T00:00:00.000Z" }),
      PARAMS,
    );

    expect(response.status).toBe(400);
    expect(prismaMock.announcement.update).not.toHaveBeenCalled();
  });

  it("menerima tanggal berakhir yang masih setelah tanggal mulai tersimpan", async () => {
    const response = await PUT(
      permintaan({ endDate: "2026-10-25T00:00:00.000Z" }),
      PARAMS,
    );

    expect(response.status).toBe(200);
    expect(prismaMock.announcement.update).toHaveBeenCalled();
  });
});
