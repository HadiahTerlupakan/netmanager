import type { Prisma, WorkOrderStatus } from "@prisma/client";
import type {
  CanvasingListFilters,
  UpdateCanvasingInput,
} from "../domain/ports/ICanvasingRepository";
import type {
  MitraReferenceEntity,
  SiteReferenceEntity,
} from "../domain/entities/CanvasingEntity";
import type { CanvasingMitraLookup } from "./CanvasingRepository";

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
  sites: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.UserSelect;

const pointClaimSelect = {
  id: true,
  status: true,
  buktiUrls: true,
  keterangan: true,
  pointValue: true,
  reviewNotes: true,
  reviewedAt: true,
  reviewedBy: { select: { name: true } },
  createdAt: true,
} satisfies Prisma.PointClaimSelect;

export const canvasingUserWithSiteSelect = {
  ...canvasingUserSelect,
  sites: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.UserSelect;

export function createCanvasingDetailInclude(): Prisma.CanvasingInclude {
  return {
    user: { select: canvasingUserSelect },
    approver: { select: { id: true, name: true } },
    workOrder: { select: { id: true, workOrderNumber: true, status: true } },
    pointClaims: { select: pointClaimSelect },
  };
}

export function createCanvasingListInclude(): Prisma.CanvasingInclude {
  return {
    user: { select: canvasingUserSelect },
    workOrder: { select: { workOrderNumber: true, status: true } },
    pointClaims: { select: pointClaimSelect },
  };
}

export function buildCanvasingUpdateInput(
  data: UpdateCanvasingInput,
): Prisma.CanvasingUncheckedUpdateInput {
  return {
    ...(data.nama !== undefined ? { nama: data.nama as string } : {}),
    ...(data.noKtp !== undefined ? { noKtp: data.noKtp as string } : {}),
    ...(data.noTelpon !== undefined
      ? { noTelpon: data.noTelpon as string }
      : {}),
    ...(data.email !== undefined ? { email: data.email as string } : {}),
    ...(data.alamat !== undefined ? { alamat: data.alamat as string } : {}),
    ...(data.kabel !== undefined ? { kabel: data.kabel as number } : {}),
    ...(data.odp !== undefined ? { odp: data.odp as string } : {}),
    ...(data.paket !== undefined ? { paket: data.paket as string } : {}),
    ...(data.sn !== undefined ? { sn: data.sn as string | null } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.foto !== undefined ? { foto: data.foto as string | null } : {}),
    ...(data.fotoKtp !== undefined
      ? { fotoKtp: data.fotoKtp as string | null }
      : {}),
    ...(data.workOrderId !== undefined
      ? { workOrderId: data.workOrderId as string | null }
      : {}),
    ...(data.approvedBy !== undefined
      ? { approvedBy: data.approvedBy as string | null }
      : {}),
    ...(data.approvedAt !== undefined
      ? { approvedAt: data.approvedAt as Date | null }
      : {}),
  };
}

export async function buildCanvasingWhereClause(
  lookup: CanvasingMitraLookup,
  filters?: CanvasingListFilters,
): Promise<Prisma.CanvasingWhereInput> {
  const normalizedSearch = normalizeSearch(filters?.search);
  const siteScope = filters?.siteId
    ? await buildSiteScope(lookup, filters.siteId)
    : {};

  return {
    AND: [
      filters?.status ? { status: filters.status } : {},
      filters?.salesId ? { salesId: filters.salesId } : {},
      filters?.mitraId ? { mitraId: filters.mitraId } : {},
      siteScope,
      normalizedSearch ? buildSearchClause(normalizedSearch) : {},
    ],
  };
}

export async function buildCanvasingSummaryScope(
  lookup: CanvasingMitraLookup,
  filters?: CanvasingListFilters,
): Promise<Prisma.CanvasingWhereInput> {
  if (!filters) {
    return buildCanvasingWhereClause(lookup);
  }

  const { status: _status, ...summaryFilters } = filters;
  return buildCanvasingWhereClause(lookup, summaryFilters);
}

export function countCanvasingWorkOrdersByDate(input: {
  db:
    | Prisma.TransactionClient
    | {
        canvasing: { count(args: Prisma.CanvasingCountArgs): Promise<number> };
      };
  salesScope: Prisma.CanvasingWhereInput;
  statuses: WorkOrderStatus[];
  dateField: "startedAt" | "completedAt";
  startDate: Date;
  endDate: Date;
}) {
  return input.db.canvasing.count({
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

export function getStartedWorkOrderStatuses() {
  return STARTED_WORK_ORDER_STATUSES;
}

export function getCompletedWorkOrderStatuses() {
  return COMPLETED_WORK_ORDER_STATUSES;
}

export async function buildCanvasingSummary(
  db: {
    canvasing: { count(args: Prisma.CanvasingCountArgs): Promise<number> };
  },
  summaryScope: Prisma.CanvasingWhereInput,
) {
  const [total, pending, approved, rejected, pendingClaims] = await Promise.all(
    [
      db.canvasing.count({ where: summaryScope }),
      db.canvasing.count({
        where: { AND: [summaryScope, { status: "PENDING" }] },
      }),
      db.canvasing.count({
        where: { AND: [summaryScope, { status: "APPROVED" }] },
      }),
      db.canvasing.count({
        where: { AND: [summaryScope, { status: "REJECTED" }] },
      }),
      db.canvasing.count({
        where: {
          AND: [summaryScope, { pointClaims: { is: { status: "PENDING" } } }],
        },
      }),
    ],
  );

  return { total, pending, approved, rejected, pendingClaims };
}

export async function findMitraReference(
  lookup: CanvasingMitraLookup,
  mitraId?: string | null,
): Promise<MitraReferenceEntity | null> {
  if (!mitraId) {
    return null;
  }

  const mitra = await lookup.findMitraSummary(mitraId);
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

export async function findMitraReferenceWithSite(
  lookup: CanvasingMitraLookup,
  mitraId?: string | null,
): Promise<MitraReferenceEntity | null> {
  const mitra = await findMitraReference(lookup, mitraId);
  if (!mitra) {
    return null;
  }

  const site = await findSiteReference(lookup, mitra.siteId);
  return { ...mitra, site };
}

async function findSiteReference(
  lookup: CanvasingMitraLookup,
  siteId?: string | null,
): Promise<SiteReferenceEntity | null> {
  if (!siteId) {
    return null;
  }

  const site = await lookup.findSiteSummary(siteId);
  if (!site) {
    return null;
  }

  return { id: site.id, name: site.name };
}

function buildSearchClause(search: string): Prisma.CanvasingWhereInput {
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

async function buildSiteScope(
  lookup: CanvasingMitraLookup,
  siteId: string,
): Promise<Prisma.CanvasingWhereInput> {
  const mitraIds = await lookup.findMitraIdsBySite(siteId);
  return {
    OR: [
      { user: { siteId } },
      mitraIds.length > 0
        ? { mitraId: { in: mitraIds } }
        : { mitraId: EMPTY_MITRA_MATCH },
    ],
  };
}

function normalizeSearch(search?: string): string | undefined {
  const trimmedSearch = search?.trim();
  return trimmedSearch ? trimmedSearch : undefined;
}
