import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProspekEntity } from "@/modules/presurvei";

/**
 * Promosi mengubah prospek menjadi canvasing dan memicu work order instalasi —
 * tindakan yang tidak bisa dibatalkan dari sisi presurvei. Pembatasan
 * kepemilikannya karena itu perlu dijaga sama ketatnya dengan route lain.
 */

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  jadikanCanvasing: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockFns.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  authConfig: {},
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock("@/modules/presurvei", async () => {
  const actual = await vi.importActual<typeof import("@/modules/presurvei")>(
    "@/modules/presurvei",
  );

  return {
    ...actual,
    ProspekKonversiService: class {
      jadikanCanvasing = mockFns.jadikanCanvasing;
    },
  };
});

import { POST } from "@/app/api/presurvei/prospek/[id]/jadikan-canvasing/route";

const ID_SESI = "sales-a";

const beriPermission = (permissions: string[]): void => {
  mockFns.getServerSession.mockResolvedValue({
    user: { id: ID_SESI, email: "sales-a@contoh.id", permissions },
  });
  mockFns.getUserPermissions.mockResolvedValue(permissions);
};

const mintaPromosi = (body: Record<string, unknown>) =>
  POST(
    new NextRequest(
      "http://localhost/api/presurvei/prospek/prospek-1/jadikan-canvasing",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    ),
    { params: Promise.resolve({ id: "prospek-1" }) } as never,
  );

const bodiLengkap = { noKtp: "3201234567890001", paket: "HOME_20MBPS" };

const prospekSetelahPromosi: ProspekEntity = {
  id: "prospek-1",
  nama: "Budi",
  noTelp: "081234567890",
  email: null,
  alamat: "Jl. Merdeka 10",
  latitude: null,
  longitude: null,
  shareloc: null,
  sumber: "LAPANGAN",
  iklanId: null,
  registrationId: null,
  referralNama: null,
  status: "DEAL",
  pemilikId: ID_SESI,
  paketDiminati: null,
  catatan: null,
  canvasingId: "canvasing-1",
  konversiAt: new Date("2026-09-23T00:00:00.000Z"),
  siteId: null,
  tenantId: "tenant-1",
  createdAt: new Date("2026-09-22T00:00:00.000Z"),
  updatedAt: new Date("2026-09-23T00:00:00.000Z"),
};

describe("POST /api/presurvei/prospek/[id]/jadikan-canvasing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.jadikanCanvasing.mockResolvedValue({
      prospek: prospekSetelahPromosi,
      canvasingId: "canvasing-1",
    });
  });

  it("mengikat pemanggil mobile ke prospek miliknya sendiri", async () => {
    beriPermission(["m_presurvei:update"]);

    await mintaPromosi(bodiLengkap);

    expect(mockFns.jadikanCanvasing).toHaveBeenCalledWith(
      "prospek-1",
      expect.objectContaining(bodiLengkap),
      ID_SESI,
    );
  });

  it("membiarkan admin web mempromosikan prospek siapa pun", async () => {
    beriPermission(["presurvei:read", "presurvei:update"]);

    await mintaPromosi(bodiLengkap);

    expect(mockFns.jadikanCanvasing).toHaveBeenCalledWith(
      "prospek-1",
      expect.objectContaining(bodiLengkap),
      undefined,
    );
  });

  it("menolak permintaan tanpa nomor KTP sebelum menyentuh service", async () => {
    beriPermission(["presurvei:update"]);

    const response = await mintaPromosi({ paket: "HOME_20MBPS" });

    expect(response.status).toBe(400);
    expect(mockFns.jadikanCanvasing).not.toHaveBeenCalled();
  });

  it("menolak permintaan tanpa paket", async () => {
    beriPermission(["presurvei:update"]);

    const response = await mintaPromosi({ noKtp: "3201234567890001" });

    expect(response.status).toBe(400);
    expect(mockFns.jadikanCanvasing).not.toHaveBeenCalled();
  });

  it("menolak pemanggil tanpa permission update", async () => {
    beriPermission(["m_presurvei:read"]);

    const response = await mintaPromosi(bodiLengkap);

    expect(response.status).toBe(403);
    expect(mockFns.jadikanCanvasing).not.toHaveBeenCalled();
  });
});
