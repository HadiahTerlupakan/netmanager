import { Prisma, PointClaimStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { MarketingMapper } from "../mappers/MarketingMapper";
import type {
  IPointClaimRepository,
  CreatePointClaimInput,
  UpdatePointClaimInput,
  PointClaimFilters,
} from "../domain/ports/IPointClaimRepository";

const WO_IN_PROGRESS_POINT = 5;
const WO_COMPLETED_POINT = 3;
const APPROVED_CLAIM_POINT = 2;
const COMPLETED_WORK_ORDER_STATUSES = ["COMPLETED", "VERIFIED", "CLOSED"];
const IN_PROGRESS_WORK_ORDER_STATUSES = [
  "IN_PROGRESS",
  ...COMPLETED_WORK_ORDER_STATUSES,
];

export class PointClaimRepository implements IPointClaimRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Find canvasing data required for point claim submission. */
  async findCanvasingClaimSubmission(canvasingId: string) {
    const canvasing = await this.db.canvasing.findUnique({
      where: { id: canvasingId },
      include: {
        workOrder: true,
        pointClaims: true,
        user: { select: { name: true, siteId: true } },
      },
    });

    if (!canvasing) {
      return null;
    }

    return MarketingMapper.toClaimSubmissionDomain(canvasing as never);
  }

  /** Update canvasing lock state. */
  async updateCanvasingLock(canvasingId: string, isLocked: boolean) {
    await this.db.canvasing.update({
      where: { id: canvasingId },
      data: { isLocked },
    });
  }

  /** Create a point claim. */
  async create(data: CreatePointClaimInput) {
    const claim = await this.db.pointClaim.create({
      data: {
        canvasingId: data.canvasingId,
        salesId: data.salesId,
        buktiUrls: data.buktiUrls,
        buktiMetadata: (data.buktiMetadata ??
          Prisma.JsonNull) as Prisma.InputJsonValue,
        keterangan: data.keterangan ?? null,
      },
    });
    return MarketingMapper.toPointClaimDomain(claim);
  }

  /** Find a point claim by id. */
  async findById(id: string) {
    const claim = await this.db.pointClaim.findUnique({
      where: { id },
      include: this.createPointClaimInclude(),
    });

    if (!claim) {
      return null;
    }

    return MarketingMapper.toPointClaimDomain(claim);
  }

  /** Find a point claim by canvasing id. */
  async findByCanvasingId(canvasingId: string) {
    const claim = await this.db.pointClaim.findUnique({
      where: { canvasingId },
      include: this.createPointClaimInclude(),
    });

    if (!claim) {
      return null;
    }

    return MarketingMapper.toPointClaimDomain(claim);
  }

  /** Find all point claims using optional filters. */
  async findAll(filters?: PointClaimFilters) {
    const claims = await this.db.pointClaim.findMany({
      where: this.buildFilters(filters),
      include: this.createPointClaimInclude(),
      orderBy: { createdAt: "desc" },
    });

    return claims.map((claim) => MarketingMapper.toPointClaimDomain(claim));
  }

  /** Return point claim dashboard summary. */
  async getDashboardSummary(tenantId?: string) {
    const [approved, pending] = await Promise.all([
      this.db.pointClaim.aggregate({
        where: { status: "APPROVED", ...(tenantId ? { tenantId } : {}) },
        _sum: { pointValue: true },
        _count: { _all: true },
      }),
      this.db.pointClaim.count({
        where: { status: "PENDING", ...(tenantId ? { tenantId } : {}) },
      }),
    ]);

    return {
      totalPoints: approved._sum.pointValue ?? 0,
      approvedClaims: approved._count._all,
      pendingClaims: pending,
    };
  }

  /** Update a point claim. */
  async update(id: string, data: UpdatePointClaimInput) {
    const claim = await this.db.pointClaim.update({
      where: { id },
      data: data as never,
      include: this.createPointClaimInclude(),
    });
    return MarketingMapper.toPointClaimDomain(claim);
  }

  /** Delete a point claim by id. */
  async delete(id: string): Promise<void> {
    await this.db.pointClaim.delete({ where: { id } });
  }

  /** Return point summary for a sales user. */
  async getPointSummaryBySales(salesId: string) {
    const canvasings = await this.db.canvasing.findMany({
      where: { salesId },
      include: {
        workOrder: { select: { status: true } },
        pointClaims: { select: { status: true, pointValue: true } },
      },
    });

    return canvasings.reduce(
      (summary, canvasing) => this.accumulatePointSummary(summary, canvasing),
      this.createEmptyPointSummary(),
    );
  }

  private createPointClaimInclude(): Prisma.PointClaimInclude {
    return {
      canvasing: {
        select: {
          id: true,
          nama: true,
          alamat: true,
          paket: true,
          workOrder: { select: { workOrderNumber: true, status: true } },
        },
      },
      sales: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true } },
    };
  }

  private buildFilters(
    filters?: PointClaimFilters,
  ): Prisma.PointClaimWhereInput {
    return {
      AND: [
        filters?.status ? { status: filters.status as PointClaimStatus } : {},
        filters?.salesId ? { salesId: filters.salesId } : {},
        filters?.tenantId ? { tenantId: filters.tenantId } : {},
      ],
    };
  }

  private createEmptyPointSummary() {
    return {
      totalPoints: 0,
      approvedClaims: 0,
      pendingClaims: 0,
      woInProgressPoints: 0,
      woCompletedPoints: 0,
      claimPoints: 0,
    };
  }

  private accumulatePointSummary(
    summary: ReturnType<PointClaimRepository["createEmptyPointSummary"]>,
    canvasing: {
      workOrder: { status: string } | null;
      pointClaims: { status: string; pointValue: number } | null;
    },
  ) {
    const nextSummary = { ...summary };
    const workOrderStatus = canvasing.workOrder?.status;

    if (this.isInProgressStatus(workOrderStatus)) {
      nextSummary.woInProgressPoints += WO_IN_PROGRESS_POINT;
    }

    if (this.isCompletedStatus(workOrderStatus)) {
      nextSummary.woCompletedPoints += WO_COMPLETED_POINT;
    }

    const claim = canvasing.pointClaims;
    if (claim?.status === "APPROVED") {
      nextSummary.claimPoints += claim.pointValue || APPROVED_CLAIM_POINT;
      nextSummary.approvedClaims += 1;
    }

    if (claim?.status === "PENDING") {
      nextSummary.pendingClaims += 1;
    }

    nextSummary.totalPoints =
      nextSummary.woInProgressPoints +
      nextSummary.woCompletedPoints +
      nextSummary.claimPoints;

    return nextSummary;
  }

  private isInProgressStatus(status?: string | null): boolean {
    if (!status) {
      return false;
    }

    return IN_PROGRESS_WORK_ORDER_STATUSES.includes(status);
  }

  private isCompletedStatus(status?: string | null): boolean {
    if (!status) {
      return false;
    }

    return COMPLETED_WORK_ORDER_STATUSES.includes(status);
  }
}
