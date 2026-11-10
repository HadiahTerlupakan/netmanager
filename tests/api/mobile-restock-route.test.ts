import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getRequestPage: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
  };
});

vi.mock("@/lib/api-response", () => ({
  apiError: (message: string, _code?: string, init?: { status?: number }) =>
    NextResponse.json({ error: message }, { status: init?.status ?? 500 }),
  ErrorCodes: {
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    INTERNAL_ERROR: "INTERNAL_ERROR",
  },
}));

vi.mock("@/modules/inventory", () => ({
  getMobileRestockStatusService: () => ({
    getRequestPage: mocks.getRequestPage,
  }),
}));

import { GET } from "@/app/api/mobile/inventory/pengajuan/route";

const handler = GET as unknown as (
  req: NextRequest,
  ctx: unknown,
) => Promise<Response>;

function ctxWith(permissions: string[]) {
  return {
    session: { user: { id: "user-1", tenantId: "tenant-1" } },
    permissions,
  };
}

describe("GET /api/mobile/inventory/pengajuan", () => {
  beforeEach(() => {
    mocks.getRequestPage.mockReset();
  });

  it("menolak akun tanpa izin barang gudang", async () => {
    const response = await handler(
      new NextRequest("http://localhost/api/mobile/inventory/pengajuan"),
      ctxWith(["m_chat:read"]),
    );

    expect(response.status).toBe(403);
    expect(mocks.getRequestPage).not.toHaveBeenCalled();
  });

  it("mengembalikan pengajuan yang sudah dibentuk dan cursor berikutnya", async () => {
    mocks.getRequestPage.mockResolvedValue({
      items: [
        {
          id: "pr-1",
          nomorRequest: "PR-001",
          status: "SUBMITTED",
          createdAt: new Date("2026-11-01T03:00:00.000Z"),
          gudang: { id: "g-1", nama: "Gudang Site A" },
          items: [],
          jasaItems: [],
          purchaseOrder: null,
        },
      ],
      nextCursor: "pr-1",
    });

    const response = await handler(
      new NextRequest(
        "http://localhost/api/mobile/inventory/pengajuan?cursor=pr-0",
      ),
      ctxWith(["m_barang_keluar:read"]),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.getRequestPage).toHaveBeenCalledWith({
      actorId: "user-1",
      tenantId: "tenant-1",
      cursor: "pr-0",
    });
    expect(json.nextCursor).toBe("pr-1");
    expect(json.data[0]).toMatchObject({
      nomor: "PR-001",
      gudang: "Gudang Site A",
      status: { label: "Menunggu Persetujuan" },
    });
  });

  it("meneruskan penolakan site dari service", async () => {
    mocks.getRequestPage.mockImplementation(async () => {
      throw Object.assign(
        new Error("Akun Anda belum diberi lokasi kerja (site)."),
        { status: 403 },
      );
    });

    const response = await handler(
      new NextRequest("http://localhost/api/mobile/inventory/pengajuan"),
      ctxWith(["m_barang:read"]),
    );

    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error).toContain("lokasi kerja");
  });
});
