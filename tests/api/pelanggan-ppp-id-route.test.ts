import { NextRequest, NextResponse } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  getPppDetail: vi.fn(),
  updatePppById: vi.fn(),
  deletePppById: vi.fn(),
  canAccessSite: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createHandler: vi.fn((_options, handler) => handler),
    apiSuccess: vi.fn((data, options) =>
      NextResponse.json({ success: true, data }, options),
    ),
    apiError: vi.fn((error, code, options) =>
      NextResponse.json(
        { success: false, error, code },
        { status: options?.status ?? 500 },
      ),
    ),
    ApiErrors: {
      forbidden: vi.fn((msg) =>
        NextResponse.json({ success: false, error: msg }, { status: 403 }),
      ),
      notFound: vi.fn((msg) =>
        NextResponse.json({ success: false, error: msg }, { status: 404 }),
      ),
    },
  };
});

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockFns.revalidatePath,
}));

vi.mock("@/modules/roles", () => ({
  canAccessSite: mockFns.canAccessSite,
}));

vi.mock("@/modules/pelanggan", () => ({
  // Route PUT memvalidasi field profil/biaya dengan schema ini sebelum
  // meneruskannya ke service; tanpa diekspor di mock, route gagal di-import.
  updatePelangganProfileSchema: {
    parse: (value: unknown) => value,
  },
  PelangganAdminMutationError: class MockPelangganAdminMutationError extends Error {
    code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND";

    constructor(
      message: string,
      code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND",
    ) {
      super(message);
      this.code = code;
    }
  },
  PelangganAdminQueryService: class MockPelangganAdminQueryService {
    getPppDetail = mockFns.getPppDetail;
  },
  PelangganAdminMutationService: class MockPelangganAdminMutationService {
    updatePppById = mockFns.updatePppById;
    deletePppById = mockFns.deletePppById;
  },
}));

describe("pelanggan PPP [id] route", () => {
  let GET: (typeof import("@/app/api/pelanggan-ppp/[id]/route"))["GET"];
  let PUT: (typeof import("@/app/api/pelanggan-ppp/[id]/route"))["PUT"];
  let DELETE: (typeof import("@/app/api/pelanggan-ppp/[id]/route"))["DELETE"];
  let PelangganAdminMutationError: (typeof import("@/modules/pelanggan"))["PelangganAdminMutationError"];

  beforeAll(async () => {
    ({ GET, PUT, DELETE } = await import("@/app/api/pelanggan-ppp/[id]/route"));
    ({ PelangganAdminMutationError } = await import("@/modules/pelanggan"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.canAccessSite.mockReturnValue(true);
  });

  it("GET returns sanitized pelanggan detail from the query service", async () => {
    mockFns.getPppDetail.mockResolvedValue({
      pelanggan: {
        id: "pel-1",
        nama: "Pelanggan 1",
        username: "pel1",
        siteId: "site-1",
      },
      technicalInfo: {
        onlineStatus: "ONLINE",
      },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/pelanggan-ppp/pel-1"),
      {
        params: { id: "pel-1" },
        session: {
          user: { id: "admin-1", role: "ADMIN", tenantId: "tenant-1" },
        },
      } as never,
    );
    const json = (await response.json()) as {
      success: boolean;
      data: { password?: string; passwordHash?: string; username: string };
    };

    expect(mockFns.getPppDetail).toHaveBeenCalledWith("pel-1", "tenant-1");
    expect(json.success).toBe(true);
    expect(json.data.username).toBe("pel1");
    expect(json.data).not.toHaveProperty("password");
    expect(json.data).not.toHaveProperty("passwordHash");
  });

  it("PUT delegates update preflight to the mutation service instead of querying prisma in the route", async () => {
    mockFns.updatePppById.mockResolvedValue({
      id: "pel-1",
      nama: "Pelanggan 1",
      username: "pel1",
      siteId: "site-1",
    });

    const formData = new FormData();
    formData.set("idPelanggan", "12345678");
    formData.set("nama", "Pelanggan 1");
    formData.set("username", "pel1");
    formData.set("password", "secret");
    formData.set("hargaPaketId", "paket-1");
    formData.set("tipe", "REGULER");
    formData.set("tanggalAktif", "2026-04-01");
    formData.set("jatuhTempo", "2026-04-10");
    formData.set("status", "AKTIF");

    const response = await PUT(
      new NextRequest("http://localhost/api/pelanggan-ppp/pel-1", {
        method: "PUT",
        body: formData,
      }),
      {
        params: { id: "pel-1" },
        session: {
          user: { id: "admin-1", role: "ADMIN", tenantId: "tenant-1" },
        },
      } as never,
    );

    expect(response.status).toBe(200);
    expect(mockFns.updatePppById).toHaveBeenCalled();
    expect(prismaMock.pelanggan.findFirst).not.toHaveBeenCalled();
  });

  it("DELETE delegates delete preflight to the mutation service instead of querying prisma in the route", async () => {
    mockFns.deletePppById.mockResolvedValue({
      nama: "Pelanggan 1",
      username: "pel1",
    });

    const response = await DELETE(
      new NextRequest("http://localhost/api/pelanggan-ppp/pel-1", {
        method: "DELETE",
      }),
      {
        params: { id: "pel-1" },
        session: {
          user: { id: "admin-1", role: "ADMIN", tenantId: "tenant-1" },
        },
      } as never,
    );
    const json = (await response.json()) as {
      success: boolean;
      data: { message: string };
    };

    expect(response.status).toBe(200);
    expect(json.data.message).toBe("Pelanggan berhasil dihapus");
    expect(mockFns.deletePppById).toHaveBeenCalledWith({
      id: "pel-1",
      session: { user: { id: "admin-1", role: "ADMIN", tenantId: "tenant-1" } },
    });
    expect(prismaMock.pelanggan.findFirst).not.toHaveBeenCalled();
  });

  it("PUT maps BAD_REQUEST mutation errors to 400 responses", async () => {
    mockFns.updatePppById.mockRejectedValue(
      new PelangganAdminMutationError(
        "Tanggal aktif tidak valid",
        "BAD_REQUEST",
      ),
    );

    const formData = new FormData();
    formData.set("idPelanggan", "12345678");
    formData.set("nama", "Pelanggan 1");
    formData.set("username", "pel1");
    formData.set("password", "secret");
    formData.set("hargaPaketId", "paket-1");
    formData.set("tanggalAktif", "not-a-date");
    formData.set("jatuhTempo", "2026-04-10");

    const response = await PUT(
      new NextRequest("http://localhost/api/pelanggan-ppp/pel-1", {
        method: "PUT",
        body: formData,
      }),
      {
        params: { id: "pel-1" },
        session: {
          user: { id: "admin-1", role: "ADMIN", tenantId: "tenant-1" },
        },
      } as never,
    );
    const json = (await response.json()) as {
      success: boolean;
      error: string;
      code: string;
    };

    expect(response.status).toBe(400);
    expect(json.error).toBe("Tanggal aktif tidak valid");
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("PUT maps NOT_FOUND mutation errors to 404 responses", async () => {
    mockFns.updatePppById.mockRejectedValue(
      new PelangganAdminMutationError("Pelanggan tidak ditemukan", "NOT_FOUND"),
    );

    const formData = new FormData();
    formData.set("idPelanggan", "12345678");
    formData.set("nama", "Pelanggan 1");
    formData.set("username", "pel1");
    formData.set("password", "secret");
    formData.set("hargaPaketId", "paket-1");
    formData.set("tanggalAktif", "2026-04-01");
    formData.set("jatuhTempo", "2026-04-10");

    const response = await PUT(
      new NextRequest("http://localhost/api/pelanggan-ppp/pel-404", {
        method: "PUT",
        body: formData,
      }),
      {
        params: { id: "pel-404" },
        session: {
          user: { id: "admin-1", role: "ADMIN", tenantId: "tenant-1" },
        },
      } as never,
    );

    expect(response.status).toBe(404);
  });

  it("PUT maps FORBIDDEN mutation errors to 403 responses", async () => {
    mockFns.updatePppById.mockRejectedValue(
      new PelangganAdminMutationError("Akses ditolak", "FORBIDDEN"),
    );

    const formData = new FormData();
    formData.set("idPelanggan", "12345678");
    formData.set("nama", "Pelanggan 1");
    formData.set("username", "pel1");
    formData.set("password", "secret");
    formData.set("hargaPaketId", "paket-1");
    formData.set("tanggalAktif", "2026-04-01");
    formData.set("jatuhTempo", "2026-04-10");

    const response = await PUT(
      new NextRequest("http://localhost/api/pelanggan-ppp/pel-forbidden", {
        method: "PUT",
        body: formData,
      }),
      {
        params: { id: "pel-forbidden" },
        session: {
          user: { id: "admin-1", role: "ADMIN", tenantId: "tenant-1" },
        },
      } as never,
    );

    expect(response.status).toBe(403);
  });

  it("DELETE maps NOT_FOUND mutation errors to 404 responses", async () => {
    mockFns.deletePppById.mockRejectedValue(
      new PelangganAdminMutationError("Pelanggan tidak ditemukan", "NOT_FOUND"),
    );

    const response = await DELETE(
      new NextRequest("http://localhost/api/pelanggan-ppp/pel-404", {
        method: "DELETE",
      }),
      {
        params: { id: "pel-404" },
        session: {
          user: { id: "admin-1", role: "ADMIN", tenantId: "tenant-1" },
        },
      } as never,
    );

    expect(response.status).toBe(404);
  });

  it("DELETE maps FORBIDDEN mutation errors to 403 responses", async () => {
    mockFns.deletePppById.mockRejectedValue(
      new PelangganAdminMutationError("Akses ditolak", "FORBIDDEN"),
    );

    const response = await DELETE(
      new NextRequest("http://localhost/api/pelanggan-ppp/pel-forbidden", {
        method: "DELETE",
      }),
      {
        params: { id: "pel-forbidden" },
        session: {
          user: { id: "admin-1", role: "ADMIN", tenantId: "tenant-1" },
        },
      } as never,
    );

    expect(response.status).toBe(403);
  });
});
