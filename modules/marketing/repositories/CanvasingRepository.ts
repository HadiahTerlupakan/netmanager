import type { PrismaClient, Canvasing } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type {
  ICanvasingRepository,
  CreateCanvasingInput,
  UpdateCanvasingInput,
  CanvasingWithSalesSite,
  CanvasingWithSalesInfo,
  CanvasingListFilters,
  CanvasingListSummary,
} from "./ICanvasingRepository";

const canvasingUserSelect = {
  id: true,
  name: true,
  email: true,
  siteId: true,
} satisfies Prisma.UserSelect;

const canvasingUserWithSiteSelect = {
  ...canvasingUserSelect,
  sites: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.UserSelect;

type MitraSummary = {
  id: string;
  name: string | null;
  email: string | null;
  mitraType: string | null;
  siteId: string | null;
};

type MitraWithSite = MitraSummary & {
  sites: {
    id: string;
    name: string;
  } | null;
};

type SiteSummary = {
  id: string;
  name: string;
};

export interface CanvasingMitraLookup {
  findMitraIdsBySite(siteId: string): Promise<string[]>;
  findMitraSummary(mitraId: string): Promise<MitraSummary | null>;
  findSiteSummary(siteId: string): Promise<SiteSummary | null>;
}

export class CanvasingRepository implements ICanvasingRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly mitraLookup: CanvasingMitraLookup,
  ) {}

  async create(data: CreateCanvasingInput): Promise<CanvasingWithSalesInfo> {
    const canvasing = await this.db.canvasing.create({
      data: {
        ...data,
      },
      include: {
        user: {
          select: canvasingUserSelect,
        },
      },
    });

    const mitra = await this.findMitraSummary(canvasing.mitraId);
    return { ...canvasing, mitra } as CanvasingWithSalesInfo;
  }

  async findById(id: string): Promise<Canvasing | null> {
    return this.db.canvasing.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        approver: {
          select: {
            name: true,
          },
        },
        workOrder: {
          select: {
            workOrderNumber: true,
            status: true,
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
    });
  }

  async findByIdWithSales(id: string): Promise<CanvasingWithSalesSite | null> {
    const canvasing = await this.db.canvasing.findUnique({
      where: { id },
      include: {
        user: {
          select: canvasingUserWithSiteSelect,
        },
      },
    });

    if (!canvasing) {
      return null;
    }

    const mitra = await this.findMitraWithSite(canvasing.mitraId);
    return { ...canvasing, mitra } as CanvasingWithSalesSite;
  }

  async findAll(
    filters?: CanvasingListFilters,
    page?: number,
    limit?: number,
  ): Promise<{
    data: Canvasing[];
    total: number;
    summary: CanvasingListSummary;
  }> {
    const listScope = await this.buildListScope(filters);
    const summaryScope = await this.buildSummaryScope(filters);
    const total = await this.db.canvasing.count({ where: listScope });
    const data = await this.db.canvasing.findMany({
      where: listScope,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        workOrder: {
          select: {
            status: true,
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
      ...(page && limit ? { skip: (page - 1) * limit, take: limit } : {}),
    });
    const summary = await this.buildSummary(summaryScope);

    return { data, total, summary };
  }

  async update(id: string, data: UpdateCanvasingInput): Promise<Canvasing> {
    return this.db.canvasing.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      } as Prisma.CanvasingInclude,
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.canvasing.delete({
      where: { id },
    });
  }

  /**
   * Find canvasing linked to a work order
   */
  async findByWorkOrderId(
    workOrderId: string,
  ): Promise<{ id: string; nama: string; salesId: string | null } | null> {
    return this.db.canvasing.findFirst({
      where: { workOrderId },
      select: { id: true, nama: true, salesId: true },
    });
  }

  private async buildListScope(
    filters?: CanvasingListFilters,
  ): Promise<Prisma.CanvasingWhereInput> {
    return this.buildWhereClause(filters);
  }

  private async buildSummaryScope(
    filters?: CanvasingListFilters,
  ): Promise<Prisma.CanvasingWhereInput> {
    if (!filters) {
      return this.buildWhereClause();
    }

    const { status: _status, ...summaryFilters } = filters;
    return this.buildWhereClause(summaryFilters);
  }

  private async buildWhereClause(
    filters?: CanvasingListFilters,
  ): Promise<Prisma.CanvasingWhereInput> {
    const normalizedSearch = this.normalizeSearch(filters?.search);
    const siteScope = filters?.siteId
      ? await this.buildSiteScope(filters.siteId)
      : {};

    return {
      AND: [
        filters?.status ? { status: filters.status } : {},
        filters?.salesId ? { salesId: filters.salesId } : {},
        filters?.mitraId ? { mitraId: filters.mitraId } : {},
        siteScope,
        normalizedSearch ? this.buildSearchClause(normalizedSearch) : {},
      ],
    };
  }

  private buildSearchClause(search: string): Prisma.CanvasingWhereInput {
    return {
      OR: [
        { nama: { contains: search, mode: "insensitive" } },
        { alamat: { contains: search, mode: "insensitive" } },
        { noTelpon: { contains: search, mode: "insensitive" } },
        { paket: { contains: search, mode: "insensitive" } },
        { odp: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  private async buildSiteScope(
    siteId: string,
  ): Promise<Prisma.CanvasingWhereInput> {
    const mitraIds = await this.findMitraIdsBySite(siteId);

    return {
      OR: [
        { user: { siteId } },
        mitraIds.length > 0
          ? { mitraId: { in: mitraIds } }
          : { mitraId: "__no_mitra_match__" },
      ],
    };
  }

  private async findMitraIdsBySite(siteId: string): Promise<string[]> {
    return this.mitraLookup.findMitraIdsBySite(siteId);
  }

  private async findMitraSummary(
    mitraId?: string | null,
  ): Promise<MitraSummary | null> {
    if (!mitraId) {
      return null;
    }

    return this.mitraLookup.findMitraSummary(mitraId);
  }

  private async findMitraWithSite(
    mitraId?: string | null,
  ): Promise<MitraWithSite | null> {
    if (!mitraId) {
      return null;
    }

    const mitra = await this.findMitraSummary(mitraId);
    if (!mitra) {
      return null;
    }

    const site = await this.findSiteSummary(mitra.siteId);
    return {
      ...mitra,
      sites: site,
    };
  }

  private async findSiteSummary(
    siteId?: string | null,
  ): Promise<SiteSummary | null> {
    if (!siteId) {
      return null;
    }

    return this.mitraLookup.findSiteSummary(siteId);
  }

  private normalizeSearch(search?: string): string | undefined {
    const trimmedSearch = search?.trim();
    return trimmedSearch ? trimmedSearch : undefined;
  }

  private async buildSummary(
    summaryScope: Prisma.CanvasingWhereInput,
  ): Promise<CanvasingListSummary> {
    const [total, pending, approved, rejected, pendingClaims] =
      await Promise.all([
        this.db.canvasing.count({ where: summaryScope }),
        this.db.canvasing.count({
          where: { AND: [summaryScope, { status: "PENDING" }] },
        }),
        this.db.canvasing.count({
          where: { AND: [summaryScope, { status: "APPROVED" }] },
        }),
        this.db.canvasing.count({
          where: { AND: [summaryScope, { status: "REJECTED" }] },
        }),
        this.db.canvasing.count({
          where: {
            AND: [summaryScope, { pointClaims: { is: { status: "PENDING" } } }],
          },
        }),
      ]);

    return {
      total,
      pending,
      approved,
      rejected,
      pendingClaims,
    };
  }
}
