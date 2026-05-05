import { RabRevisionStatus } from "../types/invoice.enums";
import { createRouteServiceError } from "./RouteServiceError";

const ASCENDING = "asc" as const;
const DESCENDING = "desc" as const;
const REVISION_NOT_FOUND_LABEL = "Revisi RAB";
const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;

const REVISION_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: { select: { name: true } },
} as const;

const REVISION_DETAIL_INCLUDE = {
  items: { orderBy: { sortOrder: ASCENDING } },
  approvals: {
    include: { user: { select: REVISION_USER_SELECT } },
    orderBy: { createdAt: ASCENDING },
  },
} as const;

const REVISION_LIST_ORDER_BY = {
  revisionNumber: DESCENDING,
} as const;

const REVISION_DRAFT_WHERE = {
  status: RabRevisionStatus.DRAFT,
} as const;

/** Menyediakan include standar detail revisi RAB. */
export function getRabRevisionDetailInclude() {
  return REVISION_DETAIL_INCLUDE;
}

/** Membangun query detail revisi berdasarkan id. */
export function createRabRevisionDetailQuery(revisionId: string) {
  return {
    where: { id: revisionId },
    include: REVISION_DETAIL_INCLUDE,
  };
}

/** Membangun query daftar revisi berdasarkan project. */
export function createRabRevisionListQuery(projectId: string) {
  return {
    where: { rabProjectId: projectId },
    include: REVISION_DETAIL_INCLUDE,
    orderBy: REVISION_LIST_ORDER_BY,
  };
}

/** Membangun query draft revisi aktif per project. */
export function createRabRevisionDraftQuery(projectId: string) {
  return {
    where: { rabProjectId: projectId, ...REVISION_DRAFT_WHERE },
    include: REVISION_DETAIL_INCLUDE,
  };
}

/** Memastikan revisi berada di project yang sesuai. */
export function assertRevisionBelongsToProject(
  revision: { rabProjectId: string } | null,
  projectId: string,
) {
  if (!revision || revision.rabProjectId !== projectId) {
    throw createRouteServiceError(REVISION_NOT_FOUND_LABEL, NOT_FOUND_STATUS);
  }
}

/** Memastikan revisi masih draft sebelum boleh diubah. */
export function assertDraftRevisionStatus(status: RabRevisionStatus | string) {
  if (status !== RabRevisionStatus.DRAFT) {
    throw createRouteServiceError(
      "Hanya revisi dengan status DRAFT yang dapat diubah",
      BAD_REQUEST_STATUS,
    );
  }
}

/** Memastikan revisi draft dapat diajukan ke approval. */
export function assertDraftRevisionCanBeSubmitted(input: {
  status: RabRevisionStatus | string;
  itemsLength: number;
}) {
  if (input.status !== RabRevisionStatus.DRAFT) {
    throw createRouteServiceError(
      "Hanya revisi dengan status DRAFT yang dapat diajukan",
      BAD_REQUEST_STATUS,
    );
  }

  if (input.itemsLength === 0) {
    throw createRouteServiceError(
      "Revisi harus memiliki minimal satu item",
      BAD_REQUEST_STATUS,
    );
  }
}
