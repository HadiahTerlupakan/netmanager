import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/database", () => ({ prisma: {} }));

import {
  MOBILE_RESTOCK_PAGE_SIZE,
  MobileRestockStatusService,
} from "@/modules/inventory/services/MobileRestockStatusService";

const EMPTY_PAGE = {
  items: [] as unknown[],
  nextCursor: null as string | null,
};

function setup(user: unknown) {
  const actorRepository = {
    findMobileActorUser: vi.fn().mockResolvedValue(user),
    findMobileActorMitra: vi.fn().mockResolvedValue(null),
  };
  const requests = {
    findPurchaseRequestPage: vi.fn().mockResolvedValue(EMPTY_PAGE),
  };
  const service = new MobileRestockStatusService(
    actorRepository as never,
    requests as never,
  );
  return { service, requests };
}

const siteOnlyUser = (siteIds: string[]) => ({
  id: "user-1",
  role: {
    name: "OPERATOR",
    permission: [{ resource: "m_barang", action: "site_only" }],
  },
  sites: siteIds[0] ? { id: siteIds[0] } : null,
  userSites: siteIds.map((siteId) => ({ siteId })),
});

describe("MobileRestockStatusService.getRequestPage", () => {
  it("membatasi ke site akun dan meneruskan cursor", async () => {
    const { service, requests } = setup(siteOnlyUser(["site-1"]));

    await service.getRequestPage({
      actorId: "user-1",
      tenantId: "tenant-1",
      cursor: "pr-9",
    });

    expect(requests.findPurchaseRequestPage).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      siteIds: ["site-1"],
      limit: MOBILE_RESTOCK_PAGE_SIZE,
      cursor: "pr-9",
    });
  });

  it("akun tanpa batasan site melihat semua gudang tenant", async () => {
    const { service, requests } = setup({
      id: "user-1",
      role: { name: "ADMIN", permission: [] },
      sites: null,
      userSites: [],
    });

    await service.getRequestPage({ actorId: "user-1", tenantId: "tenant-1" });

    expect(requests.findPurchaseRequestPage).toHaveBeenCalledWith(
      expect.objectContaining({ siteIds: undefined }),
    );
  });

  it("akun terbatas tanpa site ditolak dengan pesan yang bisa ditindaklanjuti", async () => {
    const { service, requests } = setup(siteOnlyUser([]));

    await expect(
      service.getRequestPage({ actorId: "user-1", tenantId: "tenant-1" }),
    ).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("belum diberi lokasi kerja (site)"),
    });
    expect(requests.findPurchaseRequestPage).not.toHaveBeenCalled();
  });

  it("mitra ditolak walau punya site, karena datanya khusus internal", async () => {
    const actorRepository = {
      findMobileActorUser: vi.fn().mockResolvedValue(null),
      findMobileActorMitra: vi
        .fn()
        .mockResolvedValue({ id: "mitra-1", siteId: "site-1" }),
    };
    const requests = { findPurchaseRequestPage: vi.fn() };
    const service = new MobileRestockStatusService(
      actorRepository as never,
      requests as never,
    );

    await expect(
      service.getRequestPage({ actorId: "mitra-1", tenantId: "tenant-1" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(requests.findPurchaseRequestPage).not.toHaveBeenCalled();
  });

  it("akun yang tidak ditemukan dijawab 404", async () => {
    const { service } = setup(null);

    await expect(
      service.getRequestPage({ actorId: "x", tenantId: "tenant-1" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
