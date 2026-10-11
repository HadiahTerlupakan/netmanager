import { describe, expect, it, vi } from "vitest";
import { MarketingCanvasingListRouteService } from "@/modules/marketing/services/MarketingCanvasingListRouteService";

const ID_MITRA_SALES = "cmov3i5t00001r0n9rc38lg32";
const ID_KARYAWAN_SALES = "e452c1be-cd38-4513-850e-34dd10ea428b";

const BADAN_CANVASING = {
  nama: "Pelanggan Uji",
  noKtp: "3201234567890001",
  noTelpon: "081200000001",
  alamat: "Jl. Uji No.1",
  kabel: 50,
  paket: "HOME_20MBPS",
};

function buatService() {
  const service = {
    createRequest: vi.fn().mockResolvedValue({ id: "canvasing-1" }),
    getAllRequests: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      summary: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        pendingClaims: 0,
      },
      nextCursor: null,
    }),
  };
  return {
    service,
    routeService: new MarketingCanvasingListRouteService(service as never),
  };
}

function sesiMitra(
  permissions: string[] = ["m_canvasing:read", "m_canvasing:create"],
) {
  return {
    id: ID_MITRA_SALES,
    tenantId: "tenant-1",
    role: "MITRA",
    permissions,
  };
}

describe("atribusi canvasing untuk mitra", () => {
  it("menyimpan canvasing mitra di mitraId, bukan salesId", async () => {
    const { service, routeService } = buatService();

    const hasil = await routeService.create({
      session: sesiMitra(),
      permissions: ["m_canvasing:create"],
      isSuperAdmin: false,
      body: { ...BADAN_CANVASING },
    });

    expect(hasil.success).toBe(true);
    // `salesId` ber-FK ke tabel `User`; id mitra di sana membuat insert gagal
    // dengan `canvasing_salesId_fkey`.
    expect(service.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ mitraId: ID_MITRA_SALES, salesId: null }),
    );
  });

  it("tetap memakai salesId untuk karyawan", async () => {
    const { service, routeService } = buatService();

    await routeService.create({
      session: { id: ID_KARYAWAN_SALES, tenantId: "tenant-1", role: "SALES" },
      permissions: ["canvasing:create"],
      isSuperAdmin: false,
      body: { ...BADAN_CANVASING },
    });

    expect(service.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ salesId: ID_KARYAWAN_SALES, mitraId: null }),
    );
  });

  it("mengabaikan atribusi kiriman klien agar komisi tidak bisa dialihkan", async () => {
    const { service, routeService } = buatService();

    await routeService.create({
      session: sesiMitra(),
      permissions: ["m_canvasing:create"],
      isSuperAdmin: false,
      body: {
        ...BADAN_CANVASING,
        mitraId: "mitra-orang-lain",
        salesId: "sales-orang-lain",
      },
    });

    expect(service.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ mitraId: ID_MITRA_SALES, salesId: null }),
    );
  });

  it("menyaring daftar canvasing mitra dengan mitraId", async () => {
    const { service, routeService } = buatService();

    const hasil = await routeService.list({
      session: sesiMitra(),
      permissions: ["m_canvasing:read"],
      isSuperAdmin: false,
      page: 1,
      limit: 10,
    });

    expect(hasil.success).toBe(true);
    const [filters] = service.getAllRequests.mock.calls[0];
    expect(filters).toMatchObject({ mitraId: ID_MITRA_SALES });
    expect(filters).not.toHaveProperty("salesId");
    expect(filters).not.toHaveProperty("salesIds");
  });

  it("menolak mitra tanpa fitur canvasing", async () => {
    const { service, routeService } = buatService();

    const hasil = await routeService.list({
      session: sesiMitra(["m_dashboard:read", "m_work_order:read"]),
      permissions: ["m_dashboard:read", "m_work_order:read"],
      isSuperAdmin: false,
      page: 1,
      limit: 10,
    });

    expect(hasil).toMatchObject({ success: false, status: 403 });
    expect(service.getAllRequests).not.toHaveBeenCalled();
  });
});
