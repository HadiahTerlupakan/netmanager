import { hash } from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";
import {
  PELANGGAN_SESI,
  useStatefulPelangganStores,
} from "../../helpers/pelanggan-session-stores";
import {
  generatePelangganTokenPair,
  verifyPelangganRefreshToken,
} from "@/lib/jwt";
import { CustomerPortalService } from "@/modules/pelanggan/services/CustomerPortalService";
import { PelangganAdminMutationService } from "@/modules/pelanggan/services/PelangganAdminMutationService";

vi.mock("@/modules/database", () => ({ prisma: prismaMock }));
vi.mock("@/modules/events", () => ({
  CustomerEventDispatcher: { onUpdated: vi.fn() },
  BillingEventDispatcher: { onPackageChanged: vi.fn() },
}));

describe("ganti password dari portal pelanggan", () => {
  beforeEach(() => {
    useStatefulPelangganStores();
  });

  // Aplikasi mobile dan portal web sama-sama memanggil PATCH
  // /api/customer/profile, jadi inilah satu-satunya jalur ganti password
  // pelanggan yang benar-benar dipakai.
  it("signs out every device of the customer", async () => {
    const web = await generatePelangganTokenPair(PELANGGAN_SESI);
    const mobile = await generatePelangganTokenPair(PELANGGAN_SESI);
    const repository = {
      getPasswordHash: vi.fn().mockResolvedValue(await hash("lama123", 4)),
      updateProfile: vi.fn().mockResolvedValue({}),
    };

    await new CustomerPortalService(repository as never).changePassword(
      PELANGGAN_SESI.id,
      "lama123",
      "baru123",
    );

    expect((await verifyPelangganRefreshToken(web.refreshToken)).valid).toBe(
      false,
    );
    expect((await verifyPelangganRefreshToken(mobile.refreshToken)).valid).toBe(
      false,
    );
  });
});

describe("admin mengganti password login pelanggan", () => {
  const existing = {
    id: "pel-1",
    idPelanggan: "PLG-001",
    nama: "Budi",
    username: "budi",
    password: "pppoe123",
    hargaPaketId: "pkg-1",
    tipe: "REGULER",
    status: "AKTIF",
    autoIsolir: true,
    email: null as string | null,
    siteId: null as string | null,
    tenantId: "tenant-1",
    passwordHash: null as string | null,
    tanggalAktif: new Date("2024-01-01"),
    jatuhTempo: new Date("2024-02-01"),
  };
  const session = {
    user: { id: "admin-1", role: "ADMIN", tenantId: "tenant-1" },
  };
  const baseData = {
    idPelanggan: "PLG-001",
    nama: "Budi",
    username: "budi",
    password: "pppoe123",
    hargaPaketId: "pkg-1",
    tipe: "REGULER",
    tanggalAktif: "2024-01-01",
    jatuhTempo: "2024-02-01",
    status: "AKTIF",
    autoIsolir: true,
    email: null as string | null,
    siteId: null as string | null,
    invoiceAction: null as string | null,
    passwordLogin: null as string | null,
  };
  let repository: {
    findForAdminMutation: ReturnType<typeof vi.fn>;
    updateAdminPppById: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    repository = {
      findForAdminMutation: vi.fn(),
      updateAdminPppById: vi.fn().mockResolvedValue(existing),
    };
  });

  async function updateWith(passwordLogin: string | null, passwordHash = "") {
    repository.findForAdminMutation.mockResolvedValue({
      ...existing,
      passwordHash: passwordHash || null,
    });
    await new PelangganAdminMutationService(repository as never).updatePppById({
      id: "pel-1",
      session: session as never,
      data: { ...baseData, passwordLogin } as never,
    });
    return repository.updateAdminPppById.mock.calls[0][1];
  }

  it("signs out every device when the login password changes", async () => {
    const data = await updateWith("rahasia-baru", await hash("lama123", 4));

    expect(data.tokenVersion).toEqual({ increment: 1 });
  });

  it("keeps the customer's sessions when the login password is unchanged", async () => {
    const data = await updateWith("lama123", await hash("lama123", 4));

    expect(data).not.toHaveProperty("tokenVersion");
  });

  it("keeps the customer's sessions when only other fields change", async () => {
    const data = await updateWith(null);

    expect(data).not.toHaveProperty("tokenVersion");
  });
});
