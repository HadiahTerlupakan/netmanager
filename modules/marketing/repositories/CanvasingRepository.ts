import type { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { MarketingMapper } from "../mappers/MarketingMapper";
import type {
  ICanvasingRepository,
  CreateCanvasingInput,
  UpdateCanvasingInput,
  CanvasingListFilters,
  FindAllCanvasingResult,
  FindAllCanvasingOptions,
} from "../domain/ports/ICanvasingRepository";

type MitraSummary = {
  id: string;
  name: string | null;
  email: string | null;
  mitraType: string | null;
  siteId: string | null;
};

export type SiteSummary = {
  id: string;
  name: string;
};

export interface CanvasingMitraLookup {
  findMitraIdsBySite(siteId: string): Promise<string[]>;
  findMitraSummary(mitraId: string): Promise<MitraSummary | null>;
  findSiteSummary(siteId: string): Promise<SiteSummary | null>;
}

import {
  buildCanvasingSummary,
  buildCanvasingSummaryScope,
  buildCanvasingUpdateInput,
  buildCanvasingWhereClause,
  countCanvasingWorkOrdersByDate,
  createCanvasingDetailInclude,
  createCanvasingListInclude,
  findMitraReference,
  findMitraReferenceWithSite,
  getCompletedWorkOrderStatuses,
  getStartedWorkOrderStatuses,
  canvasingUserWithSiteSelect,
} from "./canvasing.repository.helpers";

export class CanvasingRepository implements ICanvasingRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly mitraLookup: CanvasingMitraLookup,
  ) {}

  /** Create a new canvasing request. */
  async create(data: CreateCanvasingInput) {
    const createdCanvasing = await this.db.canvasing.create({
      data,
      include: {
        user: { select: { id: true, name: true, email: true, siteId: true } },
      },
    });
    const mitra = await findMitraReference(
      this.mitraLookup,
      createdCanvasing.mitraId,
    );
    return MarketingMapper.toCanvasingDomainWithSite(createdCanvasing, mitra);
  }

  /** Find a canvasing request by id. */
  async findById(id: string) {
    const canvasing = await this.db.canvasing.findUnique({
      where: { id },
      include: createCanvasingDetailInclude(),
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

    const mitra = await findMitraReferenceWithSite(
      this.mitraLookup,
      canvasing.mitraId,
    );
    return MarketingMapper.toCanvasingDomainWithSite(canvasing, mitra);
  }

  /** Find canvasing requests using optional filters and pagination. */
  async findAll(
    filters?: CanvasingListFilters,
    page?: number,
    limit?: number,
    options?: FindAllCanvasingOptions,
  ): Promise<FindAllCanvasingResult> {
    const listScope = await buildCanvasingWhereClause(
      this.mitraLookup,
      filters,
    );
    const summaryScope = await buildCanvasingSummaryScope(
      this.mitraLookup,
      filters,
    );
    const total = await this.db.canvasing.count({ where: listScope });

    const cursor = options?.cursor ?? null;
    const useCursor = Boolean(cursor !== null && limit);
    // Cursor pagination butuh ordering deterministik. createdAt bisa sama,
    // jadi pakai id sebagai tie-breaker sekunder.
    const orderBy: Prisma.CanvasingOrderByWithRelationInput[] = [
      { createdAt: "desc" },
      { id: "desc" },
    ];

    const paginationArgs: {
      skip?: number;
      take?: number;
      cursor?: { id: string };
    } = {};
    if (useCursor) {
      paginationArgs.take = limit;
      paginationArgs.skip = 1; // skip cursor row itself
      paginationArgs.cursor = { id: cursor as string };
    } else if (page && limit) {
      paginationArgs.skip = (page - 1) * limit;
      paginationArgs.take = limit;
    }

    const canvasings = await this.db.canvasing.findMany({
      where: listScope,
      include: createCanvasingListInclude(),
      orderBy,
      ...paginationArgs,
    });
    const summary = await buildCanvasingSummary(this.db, summaryScope);

    const data = await Promise.all(
      canvasings.map(async (item) => {
        const mitra = await findMitraReference(this.mitraLookup, item.mitraId);
        return MarketingMapper.toCanvasingDomainWithSite(item, mitra);
      }),
    );

    const nextCursor =
      useCursor && limit && canvasings.length === limit
        ? canvasings[canvasings.length - 1].id
        : null;

    return { data, total, summary, nextCursor };
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
    const startedStatuses = getStartedWorkOrderStatuses();
    const completedStatuses = getCompletedWorkOrderStatuses();
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
      countCanvasingWorkOrdersByDate({
        db: this.db,
        salesScope,
        statuses: startedStatuses,
        dateField: "startedAt",
        startDate: input.today,
        endDate: input.tomorrow,
      }),
      countCanvasingWorkOrdersByDate({
        db: this.db,
        salesScope,
        statuses: completedStatuses,
        dateField: "completedAt",
        startDate: input.today,
        endDate: input.tomorrow,
      }),
      countCanvasingWorkOrdersByDate({
        db: this.db,
        salesScope,
        statuses: completedStatuses,
        dateField: "completedAt",
        startDate: input.weekStart,
        endDate: input.tomorrow,
      }),
      countCanvasingWorkOrdersByDate({
        db: this.db,
        salesScope,
        statuses: completedStatuses,
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
      data: buildCanvasingUpdateInput(data),
      include: createCanvasingDetailInclude(),
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
}
