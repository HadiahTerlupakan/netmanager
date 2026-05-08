import { describe, expect, it, vi } from "vitest";
import { CanvasingRepository } from "@/modules/marketing/repositories/CanvasingRepository";
import { prismaMock } from "../../setup";

function createMitraLookupMock() {
  return {
    findMitraIdsBySite: vi.fn(),
    findMitraSummary: vi.fn(),
    findSiteSummary: vi.fn(),
  };
}

function createRepository(
  mitraLookup = createMitraLookupMock(),
): CanvasingRepository {
  return new CanvasingRepository(prismaMock as never, mitraLookup);
}

describe("CanvasingRepository", () => {
  it("membangun scope list dengan search trim dan summary tanpa status filter", async () => {
    const mitraLookup = createMitraLookupMock();
    const repository = createRepository(mitraLookup);

    mitraLookup.findMitraIdsBySite.mockResolvedValue(["mitra-1"]);
    prismaMock.canvasing.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(5);
    prismaMock.canvasing.findMany.mockResolvedValue([]);

    const result = await repository.findAll(
      {
        status: "PENDING",
        salesId: "sales-1",
        siteId: "site-1",
        search: "  Fiber Home  ",
      },
      2,
      10,
    );

    expect(prismaMock.canvasing.count).toHaveBeenNthCalledWith(1, {
      where: {
        AND: [
          { status: "PENDING" },
          { salesId: "sales-1" },
          {},
          {
            OR: [
              { user: { siteId: "site-1" } },
              { mitraId: { in: ["mitra-1"] } },
            ],
          },
          {
            OR: [
              { nama: { contains: "Fiber Home", mode: "insensitive" } },
              { alamat: { contains: "Fiber Home", mode: "insensitive" } },
              { noTelpon: { contains: "Fiber Home", mode: "insensitive" } },
              { paket: { contains: "Fiber Home", mode: "insensitive" } },
              { odp: { contains: "Fiber Home", mode: "insensitive" } },
            ],
          },
        ],
      },
    });

    expect(prismaMock.canvasing.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { status: "PENDING" },
          { salesId: "sales-1" },
          {},
          {
            OR: [
              { user: { siteId: "site-1" } },
              { mitraId: { in: ["mitra-1"] } },
            ],
          },
          {
            OR: [
              { nama: { contains: "Fiber Home", mode: "insensitive" } },
              { alamat: { contains: "Fiber Home", mode: "insensitive" } },
              { noTelpon: { contains: "Fiber Home", mode: "insensitive" } },
              { paket: { contains: "Fiber Home", mode: "insensitive" } },
              { odp: { contains: "Fiber Home", mode: "insensitive" } },
            ],
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            siteId: true,
            sites: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        workOrder: {
          select: {
            status: true,
            workOrderNumber: true,
          },
        },
        pointClaims: {
          select: {
            id: true,
            status: true,
            buktiUrls: true,
            keterangan: true,
            pointValue: true,
            reviewNotes: true,
            reviewedAt: true,
            reviewedBy: {
              select: {
                name: true,
              },
            },
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: 10,
      take: 10,
    });

    expect(prismaMock.canvasing.count).toHaveBeenNthCalledWith(2, {
      where: {
        AND: [
          {},
          { salesId: "sales-1" },
          {},
          {
            OR: [
              { user: { siteId: "site-1" } },
              { mitraId: { in: ["mitra-1"] } },
            ],
          },
          {
            OR: [
              { nama: { contains: "Fiber Home", mode: "insensitive" } },
              { alamat: { contains: "Fiber Home", mode: "insensitive" } },
              { noTelpon: { contains: "Fiber Home", mode: "insensitive" } },
              { paket: { contains: "Fiber Home", mode: "insensitive" } },
              { odp: { contains: "Fiber Home", mode: "insensitive" } },
            ],
          },
        ],
      },
    });

    expect(prismaMock.canvasing.count).toHaveBeenNthCalledWith(6, {
      where: {
        AND: [
          {
            AND: [
              {},
              { salesId: "sales-1" },
              {},
              {
                OR: [
                  { user: { siteId: "site-1" } },
                  { mitraId: { in: ["mitra-1"] } },
                ],
              },
              {
                OR: [
                  { nama: { contains: "Fiber Home", mode: "insensitive" } },
                  { alamat: { contains: "Fiber Home", mode: "insensitive" } },
                  { noTelpon: { contains: "Fiber Home", mode: "insensitive" } },
                  { paket: { contains: "Fiber Home", mode: "insensitive" } },
                  { odp: { contains: "Fiber Home", mode: "insensitive" } },
                ],
              },
            ],
          },
          { pointClaims: { is: { status: "PENDING" } } },
        ],
      },
    });

    expect(result).toEqual({
      data: [],
      total: 3,
      summary: {
        total: 7,
        pending: 4,
        approved: 2,
        rejected: 1,
        pendingClaims: 5,
      },
    });
  });

  it("mengabaikan search kosong setelah trim", async () => {
    const repository = createRepository();

    prismaMock.canvasing.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prismaMock.canvasing.findMany.mockResolvedValue([]);

    await repository.findAll({ search: "   " }, 1, 10);

    expect(prismaMock.canvasing.count).toHaveBeenNthCalledWith(1, {
      where: {
        AND: [{}, {}, {}, {}, {}],
      },
    });
  });

  it("mencakup site filter untuk user dan mitra", async () => {
    const mitraLookup = createMitraLookupMock();
    const repository = createRepository(mitraLookup);

    mitraLookup.findMitraIdsBySite.mockResolvedValue(["mitra-99"]);
    prismaMock.canvasing.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prismaMock.canvasing.findMany.mockResolvedValue([]);

    await repository.findAll({ siteId: "site-99" }, 1, 10);

    expect(prismaMock.canvasing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {},
            {},
            {},
            {
              OR: [
                { user: { siteId: "site-99" } },
                { mitraId: { in: ["mitra-99"] } },
              ],
            },
            {},
          ],
        },
      }),
    );

    expect(prismaMock.canvasing.count).toHaveBeenNthCalledWith(2, {
      where: {
        AND: [
          {},
          {},
          {},
          {
            OR: [
              { user: { siteId: "site-99" } },
              { mitraId: { in: ["mitra-99"] } },
            ],
          },
          {},
        ],
      },
    });
  });
});
