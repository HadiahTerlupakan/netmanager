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

// Presenter memakai aturan status asli (entrypoint klien modul mengekspor
// aturan yang sama dengan barrel); hanya service-nya yang ditiru.
vi.mock("@/modules/inventory", async () => ({
  ...(await vi.importActual<Record<string, unknown>>(
    "@/modules/inventory/client",
  )),
  getMobileRestockStatusService: () => ({
    getRequestPage: mocks.getRequestPage,
  }),
}));

import type { MobileRestockSource } from "@/app/api/mobile/inventory/pengajuan/presentRestockRequest";
import { GET } from "@/app/api/mobile/inventory/pengajuan/route";

const handler = GET as unknown as (
  req: NextRequest,
  ctx: unknown,
) => Promise<Response>;

/** Satu baris halaman dari repository: tanggal masih `Date`. */
function makePageRow(
  overrides: Partial<MobileRestockSource> = {},
): MobileRestockSource {
  return {
    id: "pr-1",
    nomorRequest: "PR-001",
    status: "DRAFT",
    tanggal: new Date("2026-11-01T03:00:00.000Z"),
    gudang: { nama: "Gudang Site A" },
    items: [],
    jasaItems: [],
    purchaseOrderId: null,
    purchaseOrder: null,
    ...overrides,
  };
}

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
        makePageRow(),
        makePageRow({
          id: "pr-2",
          nomorRequest: "PR-002",
          status: "APPROVED",
          purchaseOrderId: "po-2",
          purchaseOrder: { status: "DRAFT" },
          items: [{ id: "item-2", jumlah: 10 }],
        }),
        makePageRow({
          id: "pr-3",
          nomorRequest: "PR-003",
          status: "ORDERED",
          purchaseOrderId: "po-3",
          purchaseOrder: { status: "ORDERED" },
          items: [{ id: "item-3", jumlah: 10, receivedQuantity: 4 }],
        }),
      ],
      nextCursor: "pr-3",
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
    expect(json.nextCursor).toBe("pr-3");
    expect(json.data).toHaveLength(3);
    expect(json.data[0]).toMatchObject({
      nomor: "PR-001",
      tanggal: "2026-11-01T03:00:00.000Z",
      gudang: "Gudang Site A",
      status: {
        kode: "AWAITING_APPROVAL",
        label: "Sudah Diajukan",
        kalimat: "Menunggu persetujuan atasan.",
      },
    });
    for (const row of json.data.slice(1)) {
      expect(row.status).toEqual({
        kode: "APPROVED",
        label: "Sudah Diajukan",
        kalimat:
          "Sudah disetujui. Menunggu admin memasukkan barangnya ke gudang.",
      });
    }
    for (const row of json.data) {
      expect(row.tahap).toEqual({
        sekarang: null,
        berhentiDi: null,
        total: 0,
        judul: [],
      });
    }
    expect(json.data[1].barang[0]).toMatchObject({
      disetujui: 10,
      dimasukkan: null,
    });
    expect(json.data[2].barang[0]).toMatchObject({
      disetujui: 10,
      dimasukkan: 4,
      dibeli: 4,
      datang: 4,
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
