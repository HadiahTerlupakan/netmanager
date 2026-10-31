import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../../setup";

vi.mock("@/modules/database", () => ({ prisma: prismaMock }));

vi.mock("@/modules/events", () => ({
  CustomerEventDispatcher: {
    onUpdated: vi.fn().mockResolvedValue(undefined),
    onSuspended: vi.fn().mockResolvedValue(undefined),
    onActivated: vi.fn().mockResolvedValue(undefined),
    onIsolated: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/modules/network", () => ({
  RadiusSyncService: class {
    handleStatusChange = vi.fn().mockResolvedValue(undefined);
    getCustomerActiveSessions = vi.fn().mockResolvedValue([]);
  },
}));

import {
  PelangganPppRouteService,
  RouteServiceError,
} from "@/modules/pelanggan/services/PelangganPppRouteService";
import { PelangganService } from "@/modules/pelanggan/services/PelangganService";

type Row = Record<string, unknown> & { id: string; tenantId: string };

const SESI_TENANT_A = {
  user: { tenantId: "tenant-a", isSuperAdmin: false, role: "ADMIN" },
};
const SESI_SUPER_ADMIN = {
  user: {
    tenantId: null as string | null,
    isSuperAdmin: true,
    role: "SUPER_ADMIN",
  },
};
/** Admin site: `pelanggan:site_only` dengan izin di sesi, seperti dari route. */
const SESI_ADMIN_SITE_1 = {
  user: {
    tenantId: "tenant-a",
    isSuperAdmin: false,
    role: "ADMIN_SITE",
    siteIds: ["site-1"],
    permissions: ["pelanggan:update", "pelanggan:site_only"],
  },
};
const SESI_TANPA_TENANT = {
  user: { tenantId: null as string | null, isSuperAdmin: false, role: "ADMIN" },
};

let rows: Row[];

const SUSPENDED_AT = new Date("2026-10-01T01:00:00.000Z");

const suspensiAktif = () => ({
  id: "susp-1",
  pelangganId: "pel-a",
  suspension_type: "PAYMENT",
  reason: "Tunggakan",
  notes: null as string | null,
  suspended_at: SUSPENDED_AT,
  expected_resume_at: null as Date | null,
  actual_resume_at: null as Date | null,
  suspended_by: "admin-a",
  resumed_by: null as string | null,
  is_active: true,
});

/** `serviceSuspension` tidak ada di tipe MockPrismaClient, tapi proxy-nya ada. */
const serviceSuspensionMock = () =>
  (prismaMock as unknown as Record<string, typeof prismaMock.pelanggan>)
    .serviceSuspension;

const pelangganRow = (
  id: string,
  tenantId: string,
  status: string,
  siteId = "site-1",
): Row => ({
  id,
  tenantId,
  status,
  siteId,
  idPelanggan: `KODE-${id}`,
  nama: `Pelanggan ${id}`,
  username: `pppoe-${id}`,
  catatan: null,
  hargaPaketId: "paket-1",
});

const cocok = (row: Row, where: Record<string, unknown>) =>
  Object.entries(where).every(([key, value]) => row[key] === value);

const statusOf = (id: string) => rows.find((row) => row.id === id)?.status;

/**
 * Prisma palsu yang benar-benar menyaring `where`: filter tenant yang hilang
 * di lookup atau di update terlihat sebagai baris tenant lain yang ikut
 * terbaca atau berubah.
 */
function pasangPrismaPalsu() {
  const cari = async ({ where }: { where: Record<string, unknown> }) => {
    const row = rows.find((candidate) => cocok(candidate, where));
    return row ? { ...row } : null;
  };
  prismaMock.pelanggan.findFirst.mockImplementation(cari);
  prismaMock.pelanggan.findUnique.mockImplementation(cari);
  prismaMock.pelanggan.update.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      const row = rows.find((candidate) => cocok(candidate, where));
      if (!row) throw new Error("Record to update not found");
      Object.assign(row, data);
      return { ...row };
    },
  );
  serviceSuspensionMock().create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      ...data,
      suspended_at: SUSPENDED_AT,
    }),
  );
  serviceSuspensionMock().findFirst.mockResolvedValue(suspensiAktif());
  serviceSuspensionMock().update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      ...suspensiAktif(),
      ...data,
    }),
  );
  serviceSuspensionMock().count.mockResolvedValue(0);
  serviceSuspensionMock().findMany.mockResolvedValue([]);
}

describe("PelangganPppRouteService — isolasi tenant aksi baris pelanggan", () => {
  const service = new PelangganPppRouteService();

  beforeEach(() => {
    rows = [
      pelangganRow("pel-a", "tenant-a", "AKTIF"),
      pelangganRow("pel-b", "tenant-b", "AKTIF"),
      pelangganRow("pel-c", "tenant-a", "AKTIF", "site-2"),
    ];
    pasangPrismaPalsu();
  });

  describe("updateCustomerStatus", () => {
    it("404 untuk pelanggan tenant lain dan statusnya tidak berubah", async () => {
      await expect(
        service.updateCustomerStatus({
          id: "pel-b",
          status: "DISMANTLE",
          session: SESI_TENANT_A,
        }),
      ).rejects.toMatchObject({ status: 404 });

      expect(statusOf("pel-b")).toBe("AKTIF");
      expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
    });

    it("jawaban untuk pelanggan tenant lain sama dengan id yang tidak ada", async () => {
      const tenantLain = await service
        .updateCustomerStatus({
          id: "pel-b",
          status: "ISOLIR",
          session: SESI_TENANT_A,
        })
        .catch((error: unknown) => error);
      const tidakAda = await service
        .updateCustomerStatus({
          id: "pel-tidak-ada",
          status: "ISOLIR",
          session: SESI_TENANT_A,
        })
        .catch((error: unknown) => error);

      expect(tenantLain).toBeInstanceOf(RouteServiceError);
      expect(tidakAda).toBeInstanceOf(RouteServiceError);
      expect(tenantLain).toMatchObject({
        status: (tidakAda as RouteServiceError).status,
        message: (tidakAda as RouteServiceError).message,
      });
    });

    it("mengubah status pelanggan di tenant sesi", async () => {
      const result = await service.updateCustomerStatus({
        id: "pel-a",
        status: "ISOLIR",
        session: SESI_TENANT_A,
      });

      expect(result.pelanggan.status).toBe("AKTIF");
      expect(result.updatedPelanggan.status).toBe("ISOLIR");
      expect(statusOf("pel-a")).toBe("ISOLIR");
    });

    it("super admin tanpa tenant sesi boleh lintas tenant", async () => {
      await service.updateCustomerStatus({
        id: "pel-b",
        status: "ISOLIR",
        session: SESI_SUPER_ADMIN,
      });

      expect(statusOf("pel-b")).toBe("ISOLIR");
    });

    it("403 untuk sesi non-super-admin tanpa tenant", async () => {
      await expect(
        service.updateCustomerStatus({
          id: "pel-a",
          status: "ISOLIR",
          session: SESI_TANPA_TENANT,
        }),
      ).rejects.toMatchObject({ status: 403 });

      expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
    });
  });

  describe("suspendCustomer / activateCustomer", () => {
    const suspendBody = {
      suspensionType: "PAYMENT",
      reason: "Tunggakan",
      terminateActiveSessions: false,
    };

    it("suspend 404 untuk pelanggan tenant lain tanpa menulis apa pun", async () => {
      await expect(
        service.suspendCustomer({
          id: "pel-b",
          userId: "admin-a",
          body: suspendBody,
          session: SESI_TENANT_A,
        }),
      ).rejects.toMatchObject({ status: 404 });

      expect(statusOf("pel-b")).toBe("AKTIF");
      expect(serviceSuspensionMock().create).not.toHaveBeenCalled();
    });

    it("suspend pelanggan di tenant sesi dan menjawab dengan suspensi yang tersimpan", async () => {
      const result = await service.suspendCustomer({
        id: "pel-a",
        userId: "admin-a",
        body: suspendBody,
        session: SESI_TENANT_A,
      });

      expect(statusOf("pel-a")).toBe("NONAKTIF");
      expect(result).toMatchObject({
        success: true,
        suspension: {
          suspensionType: "PAYMENT",
          reason: "Tunggakan",
          suspendedAt: SUSPENDED_AT.toISOString(),
          expectedResumeAt: null,
          suspendedBy: "admin-a",
          isActive: true,
        },
        customer: { id: "pel-a", status: "NONAKTIF" },
      });
    });

    it("activate pelanggan di tenant sesi dan menjawab dengan suspensi yang ditutup", async () => {
      rows[0].status = "NONAKTIF";

      const result = await service.activateCustomer({
        id: "pel-a",
        userId: "admin-a",
        body: { syncToRadius: false },
        session: SESI_TENANT_A,
      });

      expect(statusOf("pel-a")).toBe("AKTIF");
      expect(result).toMatchObject({
        success: true,
        suspension: {
          id: "susp-1",
          suspendedAt: SUSPENDED_AT.toISOString(),
          resumedBy: "admin-a",
          isActive: false,
        },
        customer: { id: "pel-a", status: "AKTIF" },
      });
      expect(result.suspension.actualResumeAt).toEqual(expect.any(String));
    });

    it("activate 404 untuk pelanggan tenant lain tanpa menulis apa pun", async () => {
      rows[1].status = "NONAKTIF";

      await expect(
        service.activateCustomer({
          id: "pel-b",
          userId: "admin-a",
          body: {},
          session: SESI_TENANT_A,
        }),
      ).rejects.toMatchObject({ status: 404 });

      expect(statusOf("pel-b")).toBe("NONAKTIF");
      expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
    });
  });

  describe("akses site (pelanggan:site_only)", () => {
    it("status: 403 untuk pelanggan di site lain, tanpa menulis", async () => {
      await expect(
        service.updateCustomerStatus({
          id: "pel-c",
          status: "ISOLIR",
          session: SESI_ADMIN_SITE_1,
        }),
      ).rejects.toMatchObject({ status: 403 });

      expect(statusOf("pel-c")).toBe("AKTIF");
      expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
    });

    it("status: lolos untuk pelanggan di site sendiri", async () => {
      await service.updateCustomerStatus({
        id: "pel-a",
        status: "ISOLIR",
        session: SESI_ADMIN_SITE_1,
      });

      expect(statusOf("pel-a")).toBe("ISOLIR");
    });

    it("suspend: 403 untuk pelanggan di site lain, tanpa menulis", async () => {
      await expect(
        service.suspendCustomer({
          id: "pel-c",
          userId: "admin-a",
          body: { suspensionType: "PAYMENT", reason: "Tunggakan" },
          session: SESI_ADMIN_SITE_1,
        }),
      ).rejects.toMatchObject({ status: 403 });

      expect(statusOf("pel-c")).toBe("AKTIF");
      expect(serviceSuspensionMock().create).not.toHaveBeenCalled();
    });

    it("activate: 403 untuk pelanggan di site lain, tanpa menulis", async () => {
      rows[2].status = "NONAKTIF";

      await expect(
        service.activateCustomer({
          id: "pel-c",
          userId: "admin-a",
          body: {},
          session: SESI_ADMIN_SITE_1,
        }),
      ).rejects.toMatchObject({ status: 403 });

      expect(statusOf("pel-c")).toBe("NONAKTIF");
      expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
    });
  });

  describe("getSuspensionHistory", () => {
    const query = {
      page: 1,
      limit: 20,
      status: "all" as const,
      sortBy: "suspendedAt" as const,
      sortOrder: "desc" as const,
      startDate: null as string | null,
      endDate: null as string | null,
      suspensionType: null as string | null,
    };

    it("null (404) untuk pelanggan tenant lain", async () => {
      const result = await service.getSuspensionHistory({
        ...query,
        id: "pel-b",
        session: SESI_TENANT_A,
      });

      expect(result).toBeNull();
    });

    it("mengembalikan histori pelanggan di tenant sesi", async () => {
      const result = await service.getSuspensionHistory({
        ...query,
        id: "pel-a",
        session: SESI_TENANT_A,
      });

      expect(result).not.toBeNull();
    });
  });
});

describe("PelangganService.updateStatusPelanggan — update ikut dibatasi tenant", () => {
  beforeEach(() => {
    rows = [
      pelangganRow("pel-a", "tenant-a", "AKTIF"),
      pelangganRow("pel-b", "tenant-b", "AKTIF"),
    ];
    pasangPrismaPalsu();
  });

  it("menolak pelanggan di luar tenant yang diberikan tanpa mengubahnya", async () => {
    await expect(
      new PelangganService().updateStatusPelanggan(
        "pel-b",
        "ISOLIR",
        "tenant-a",
      ),
    ).rejects.toThrow();

    expect(statusOf("pel-b")).toBe("AKTIF");
  });

  it("tanpa tenant tetap berlaku untuk pemanggil sistem (isolir otomatis, invoice lunas)", async () => {
    await new PelangganService().updateStatusPelanggan("pel-b", "ISOLIR");

    expect(statusOf("pel-b")).toBe("ISOLIR");
  });
});
