import type { PrismaClient, Prisma, WorkOrderStatus } from "@prisma/client";
import { MarketingMapper } from "../mappers/MarketingMapper";
import type {
  ICanvasingRepository,
  CreateCanvasingInput,
  UpdateCanvasingInput,
  CanvasingListFilters,
  FindAllCanvasingResult,
} from "../domain/ports/ICanvasingRepository";
import type {
  MitraReferenceEntity,
  SiteReferenceEntity,
} from "../domain/entities/CanvasingEntity";

const EMPTY_MITRA_MATCH = "__no_mitra_match__";
const STARTED_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "VERIFIED",
  "CLOSED",
];
const COMPLETED_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  "COMPLETED",
  "VERIFIED",
  "CLOSED",
];

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

  /** Create a new canvasing request. */
  async create(data: CreateCanvasingInput) {
    const createdCanvasing = await this.db.canvasing.create({
      data,
      include: { user: { select: canvasingUserSelect } },
    });
    const mitra = await this.findMitraReference(createdCanvasing.mitraId);
    return MarketingMapper.toCanvasingDomainWithSite(createdCanvasing, mitra);
  }

  /** Find a canvasing request by id. */
  async findById(id: string) {
    const canvasing = await this.db.canvasing.findUnique({
      where: { id },
      include: this.createCanvasingDetailInclude(),
    });

    if (!canvasing) {
      return null;
    }

    return MarketingMapper.toCanvasingDomain(canvasing);
  }

  /** Find a canvasing request with sales and site context. */
  async findByIdWithSales(id: string) {
    const canvasing = await this.db.canvasing.findUnique({
      where: { id },
      include: { user: { select: canvasingUserWithSiteSelect } },
    });

    if (!canvasing) {
      return null;
    }

    const mitra = await this.findMitraReferenceWithSite(canvasing.mitraId);
    return MarketingMapper.toCanvasingDomainWithSite(canvasing, mitra);
  }

  /** Find canvasing requests using optional filters and pagination. */
  async findAll(
    filters?: CanvasingListFilters,
    page?: number,
    limit?: number,
  ): Promise<FindAllCanvasingResult> {
    const listScope = await this.buildListScope(filters);
    const summaryScope = await this.buildSummaryScope(filters);
    const total = await this.db.canvasing.count({ where: listScope });
    const canvasings = await this.db.canvasing.findMany({
      where: listScope,
      include: this.createCanvasingListInclude(),
      orderBy: { createdAt: "desc" },
      ...(page && limit ? { skip: (page - 1) * limit, take: limit } : {}),
    });
    const summary = await this.buildSummary(summaryScope);
    const data = canvasings.map((item) =>
      MarketingMapper.toCanvasingDomain(item),
    );
    return { data, total, summary };
  }

  /** Get completion summary counts for optional sales scope. */
  async getCompletionSummary(input: {
    salesId?: string;
    today: Date;
    tomorrow: Date;
    weekStart: Date;
    monthStart: Date;
  }) {
    const salesScope = input.salesId ? { salesId: input.salesId } : {};
    const [
      total,
      woStartedToday,
      completedToday,
      completedWeek,
      completedMonth,
      pending,
      approved,
      rejected,
    ] = await Promise.all([
      this.db.canvasing.count({ where: salesScope }),
      this.countWorkOrderByDate({
        salesScope,
        statuses: STARTED_WORK_ORDER_STATUSES,
        dateField: "startedAt",
        startDate: input.today,
        endDate: input.tomorrow,
      }),
      this.countWorkOrderByDate({
        salesScope,
        statuses: COMPLETED_WORK_ORDER_STATUSES,
        dateField: "completedAt",
        startDate: input.today,
        endDate: input.tomorrow,
      }),
      this.countWorkOrderByDate({
        salesScope,
        statuses: COMPLETED_WORK_ORDER_STATUSES,
        dateField: "completedAt",
        startDate: input.weekStart,
        endDate: input.tomorrow,
      }),
      this.countWorkOrderByDate({
        salesScope,
        statuses: COMPLETED_WORK_ORDER_STATUSES,
        dateField: "completedAt",
        startDate: input.monthStart,
        endDate: input.tomorrow,
      }),
      this.db.canvasing.count({ where: { ...salesScope, status: "PENDING" } }),
      this.db.canvasing.count({ where: { ...salesScope, status: "APPROVED" } }),
      this.db.canvasing.count({ where: { ...salesScope, status: "REJECTED" } }),
    ]);

    return {
      total,
      woStartedToday,
      completedToday,
      completedWeek,
      completedMonth,
      pending,
      approved,
      rejected,
    };
  }

  /** Update a canvasing request. */
  async update(id: string, data: UpdateCanvasingInput) {
    const canvasing = await this.db.canvasing.update({
      where: { id },
      data: this.toCanvasingUpdateInput(data),
      include: this.createCanvasingDetailInclude(),
    });
    return MarketingMapper.toCanvasingDomain(canvasing);
  }

  /** Delete a canvasing request by id. */
  async delete(id: string): Promise<void> {
    await this.db.canvasing.delete({ where: { id } });
  }

  /** Find canvasing linked to a work order. */
  async findByWorkOrderId(
    workOrderId: string,
  ): Promise<{ id: string; nama: string; salesId: string | null } | null> {
    return this.db.canvasing.findFirst({
      where: { workOrderId },
      select: { id: true, nama: true, salesId: true },
    });
  }

  private countWorkOrderByDate(input: {
    salesScope: Prisma.CanvasingWhereInput;
    statuses: WorkOrderStatus[];
    dateField: "startedAt" | "completedAt";
    startDate: Date;
    endDate: Date;
  }) {
    return this.db.canvasing.count({
      where: {
        ...input.salesScope,
        workOrderId: { not: null },
        workOrder: {
          status: { in: input.statuses },
          [input.dateField]: { gte: input.startDate, lt: input.endDate },
        },
      },
    });
  }

  private toCanvasingUpdateInput(
    data: UpdateCanvasingInput,
  ): Prisma.CanvasingUncheckedUpdateInput {
    return {
      ...(data.nama !== undefined ? { nama: data.nama } : {}),
      ...(data.noKtp !== undefined ? { noKtp: data.noKtp } : {}),
      ...(data.noTelpon !== undefined ? { noTelpon: data.noTelpon } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.alamat !== undefined ? { alamat: data.alamat } : {}),
      ...(data.kabel !== undefined ? { kabel: data.kabel } : {}),
      ...(data.odp !== undefined ? { odp: data.odp } : {}),
      ...(data.paket !== undefined ? { paket: data.paket } : {}),
      ...(data.sn !== undefined ? { sn: data.sn } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.foto !== undefined ? { foto: data.foto } : {}),
      ...(data.fotoKtp !== undefined ? { fotoKtp: data.fotoKtp } : {}),
      ...(data.workOrderId !== undefined
        ? { workOrderId: data.workOrderId }
        : {}),
      ...(data.approvedBy !== undefined ? { approvedBy: data.approvedBy } : {}),
      ...(data.approvedAt !== undefined ? { approvedAt: data.approvedAt } : {}),
    };
  }

  private createCanvasingDetailInclude(): Prisma.CanvasingInclude {
    return {
      user: { select: canvasingUserSelect },
      approver: { select: { id: true, name: true } },
      workOrder: { select: { workOrderNumber: true, status: true } },
      pointClaims: {
        select: {
          id: true,
          status: true,
          buktiUrls: true,
          keterangan: true,
          pointValue: true,
          reviewNotes: true,
          reviewedAt: true,
          reviewedBy: { select: { name: true } },
          createdAt: true,
        },
      },
    };
  }

  private createCanvasingListInclude(): Prisma.CanvasingInclude {
    return {
      user: { select: canvasingUserSelect },
      workOrder: { select: { workOrderNumber: true, status: true } },
      pointClaims: {
        select: {
          id: true,
          status: true,
          buktiUrls: true,
          keterangan: true,
          pointValue: true,
          reviewNotes: true,
          reviewedAt: true,
          reviewedBy: { select: { name: true } },
          createdAt: true,
        },
      },
    };
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
    const mitraIds = await this.mitraLookup.findMitraIdsBySite(siteId);
    return {
      OR: [
        { user: { siteId } },
        mitraIds.length > 0
          ? { mitraId: { in: mitraIds } }
          : { mitraId: EMPTY_MITRA_MATCH },
      ],
    };
  }

  private async findMitraReference(
    mitraId?: string | null,
  ): Promise<MitraReferenceEntity | null> {
    if (!mitraId) {
      return null;
    }

    const mitra = await this.mitraLookup.findMitraSummary(mitraId);
    if (!mitra) {
      return null;
    }

    return {
      id: mitra.id,
      name: mitra.name,
      email: mitra.email,
      mitraType: mitra.mitraType,
      siteId: mitra.siteId,
    };
  }

  private async findMitraReferenceWithSite(
    mitraId?: string | null,
  ): Promise<MitraReferenceEntity | null> {
    const mitra = await this.findMitraReference(mitraId);
    if (!mitra) {
      return null;
    }

    const site = await this.findSiteReference(mitra.siteId);
    return { ...mitra, site };
  }

  private async findSiteReference(
    siteId?: string | null,
  ): Promise<SiteReferenceEntity | null> {
    if (!siteId) {
      return null;
    }

    const site = await this.mitraLookup.findSiteSummary(siteId);
    if (!site) {
      return null;
    }

    return { id: site.id, name: site.name };
  }

  private normalizeSearch(search?: string): string | undefined {
    const trimmedSearch = search?.trim();
    return trimmedSearch ? trimmedSearch : undefined;
  }

  private async buildSummary(summaryScope: Prisma.CanvasingWhereInput) {
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

    return { total, pending, approved, rejected, pendingClaims };
  }
}
