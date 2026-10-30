import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";
import { PelangganAdminMutationService } from "@/modules/pelanggan/services/PelangganAdminMutationService";

vi.mock("@/modules/database", () => ({ prisma: prismaMock }));

vi.mock("@/modules/events", () => ({
  CustomerEventDispatcher: {
    onUpdated: vi.fn(),
    onActivated: vi.fn(),
    onIsolated: vi.fn(),
    onSuspended: vi.fn(),
  },
  BillingEventDispatcher: { onPackageChanged: vi.fn() },
}));

const HARGA = { "pkg-kecil": 100_000, "pkg-besar": 200_000 } as const;

const STAFF = {
  user: {
    id: "staff-1",
    role: "ADMIN",
    tenantId: "tenant-1",
    isSuperAdmin: false,
  },
};
const SUPER_ADMIN = { user: { ...STAFF.user, isSuperAdmin: true } };

const DATA = {
  idPelanggan: "PLG-001",
  nama: "Budi",
  username: "budi",
  password: "",
  tipe: "REGULER" as string | null,
  tanggalAktif: "2026-10-01",
  jatuhTempo: "2026-11-01",
  status: "AKTIF" as string | null,
  autoIsolir: true,
  email: null as string | null,
  siteId: null as string | null,
  invoiceAction: null as string | null,
  passwordLogin: null as string | null,
};

const pelanggan = (hargaPaketId: string) => ({
  ...DATA,
  id: "pel-1",
  hargaPaketId,
  tenantId: "tenant-1",
  passwordHash: null as string | null,
  tanggalAktif: new Date("2026-10-01"),
  jatuhTempo: new Date("2026-11-01"),
});

/**
 * Pelanggan tidak bisa turun paket sendiri; dari admin, menurunkan paket
 * dulu cukup dengan `pelanggan:update`, yang dimiliki Admin, Helpdesk, dan
 * Manager. Kini butuh izin `pelanggan:downgrade_paket` yang diatur per role.
 */
describe("downgrade paket pelanggan dari admin", () => {
  let repository: Record<string, ReturnType<typeof vi.fn>>;
  let service: PelangganAdminMutationService;

  function ubahPaket(
    dari: keyof typeof HARGA,
    ke: keyof typeof HARGA,
    opsi: {
      session?: object;
      actorPermissions?: string[];
      upgradeApplyTime?: "IMMEDIATE" | "NEXT_CYCLE";
    } = {},
  ) {
    repository.findForAdminMutation.mockResolvedValue(pelanggan(dari));
    repository.updateAdminPppById.mockResolvedValue(pelanggan(ke));
    return service.updatePppById({
      id: "pel-1",
      session: (opsi.session ?? STAFF) as never,
      actorPermissions: opsi.actorPermissions ?? ["pelanggan:update"],
      upgradeApplyTime: opsi.upgradeApplyTime,
      data: { ...DATA, hargaPaketId: ke },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    repository = {
      findForAdminMutation: vi.fn(),
      updateAdminPppById: vi.fn(),
      findForAdminDelete: vi.fn(),
      delete: vi.fn(),
    };
    service = new PelangganAdminMutationService(repository as never);
    prismaMock.hargaPaket.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve({
          id: where.id,
          harga: HARGA[where.id as keyof typeof HARGA],
        }),
    );
  });

  it.each(["IMMEDIATE", "NEXT_CYCLE"] as const)(
    "staff tanpa izin tidak bisa menurunkan paket (%s)",
    async (upgradeApplyTime) => {
      await expect(
        ubahPaket("pkg-besar", "pkg-kecil", { upgradeApplyTime }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: expect.stringMatching(/izin downgrade/i),
      });
      expect(repository.updateAdminPppById).not.toHaveBeenCalled();
    },
  );

  it("role yang diberi izin downgrade bisa menurunkan paket", async () => {
    await ubahPaket("pkg-besar", "pkg-kecil", {
      actorPermissions: ["pelanggan:update", "pelanggan:downgrade_paket"],
    });

    expect(repository.updateAdminPppById).toHaveBeenCalled();
  });

  it("super admin selalu bisa menurunkan paket", async () => {
    await ubahPaket("pkg-besar", "pkg-kecil", {
      session: SUPER_ADMIN,
      actorPermissions: [],
    });

    expect(repository.updateAdminPppById).toHaveBeenCalled();
  });

  it("harga paket yang gagal dibaca menolak perubahan dari pengguna tanpa izin", async () => {
    prismaMock.hargaPaket.findUnique.mockRejectedValue(new Error("DB timeout"));

    await expect(ubahPaket("pkg-kecil", "pkg-besar")).rejects.toThrow();
    expect(repository.updateAdminPppById).not.toHaveBeenCalled();
  });

  it("upgrade tidak butuh izin downgrade", async () => {
    await ubahPaket("pkg-kecil", "pkg-besar");

    expect(repository.updateAdminPppById).toHaveBeenCalled();
  });
});

describe("izin downgrade di matriks hak akses", () => {
  it("bisa dicentang per role pada resource Pelanggan", async () => {
    const { ACTIONS } = await import("@/lib/permission-config");
    const { getResourceCapabilities } =
      await import("@/lib/resource-capabilities");

    expect(ACTIONS).toContain("downgrade_paket");
    expect(getResourceCapabilities("pelanggan")).toContain("downgrade_paket");
  });
});
