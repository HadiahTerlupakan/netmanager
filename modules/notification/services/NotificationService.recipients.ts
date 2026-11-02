import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import {
  buildRecipientSiteScopeWhere,
  isSiteUnrestrictedRecipient,
} from "@/lib/authorization/recipient-scope";
import { prisma } from "@/lib/prisma";
import type { UserLookupService } from "@/modules/users";
import type {
  EligibleUser,
  RecipientUser,
} from "./NotificationService.helpers";

const WORK_ORDER_RESOURCE = "workorders";
const WORK_ORDER_MOBILE_RESOURCE = "m_work_order";
const WORK_ORDER_READ_ACTION = "read";
const WORK_ORDER_DEPARTMENT_ONLY_ACTION = "department_only";
const VERIFY_ACTIONS = ["verify", "approve_request"] as const;

/** Verifikator WO portal admin: satu-satunya yang boleh dilebarkan lintas site. */
const WORK_ORDER_VERIFIER_WHERE: Prisma.UserWhereInput = {
  role: {
    permission: {
      some: {
        resource: WORK_ORDER_RESOURCE,
        action: { in: [...VERIFY_ACTIONS] },
      },
    },
  },
};

/**
 * POOL: user yang boleh dapat "Work Order Baru".
 * Site match + read permission; dept dibatasi lewat department_only
 * di workorders ATAU m_work_order (post-filter).
 */
export async function findEligibleRecipients(input: {
  userLookupService: UserLookupService;
  departmentId?: string;
  siteId?: string;
  excludeUserId?: string;
  workOrderId?: string;
  tenantId?: string | null;
}): Promise<RecipientUser[]> {
  if (!input.excludeUserId) {
    logger.warn(
      "[NotificationDebug] WARNING: findEligibleRecipients called without excludeUserId.",
    );
  }

  const scope = {
    ...input,
    tenantId: await resolveWorkOrderTenantId(input.workOrderId, input.tenantId),
  };
  const whereClause = buildEligibleRecipientWhere(scope);
  const users =
    await input.userLookupService.findManyWithDetailedRelations(whereClause);
  return users
    .filter((user: EligibleUser) => isEligibleRecipient(user, scope))
    .filter((user: EligibleUser) =>
      isPoolDepartmentAllowed(user, input.departmentId),
    )
    .map(mapRecipientUser);
}

/**
 * STAKEHOLDERS: assignee/creator/assignments + verify/approve yang cakupan
 * perannya mencakup WO ini (lihat lib/authorization/recipient-scope.ts).
 * Dipakai status change, mobile action, update, assign observers.
 */
export async function findWorkOrderStakeholders(input: {
  userLookupService: UserLookupService;
  workOrderId: string;
  siteId?: string;
  departmentId?: string;
  assignedToId?: string | null;
  createdById?: string | null;
  requestedById?: string | null;
  excludeUserId?: string;
  tenantId?: string | null;
}): Promise<RecipientUser[]> {
  const explicitIds = new Set<string>();
  for (const id of [
    input.assignedToId,
    input.createdById,
    input.requestedById,
  ]) {
    if (id) explicitIds.add(id);
  }

  try {
    const assignments = await prisma.workOrderAssignments.findMany({
      where: { workOrderId: input.workOrderId },
      select: { userId: true },
    });
    for (const row of assignments) {
      if (row.userId) explicitIds.add(row.userId);
    }
  } catch (error) {
    logger.error(
      "[Notification] Failed to load work order assignments for stakeholders:",
      error,
    );
  }

  try {
    const verifiers = await input.userLookupService.findManyWithCustomWhere({
      isActive: true,
      AND: [
        {
          role: {
            permission: {
              some: {
                OR: [
                  {
                    resource: WORK_ORDER_RESOURCE,
                    action: { in: [...VERIFY_ACTIONS] },
                  },
                  {
                    resource: WORK_ORDER_MOBILE_RESOURCE,
                    action: "verify",
                  },
                ],
              },
            },
          },
        },
        buildRecipientSiteScopeWhere({
          resource: WORK_ORDER_RESOURCE,
          siteId: input.siteId,
          departmentId: input.departmentId,
          tenantId: await resolveWorkOrderTenantId(
            input.workOrderId,
            input.tenantId,
          ),
          widenOnlyWhen: WORK_ORDER_VERIFIER_WHERE,
        }),
      ],
    });
    for (const verifier of verifiers) {
      explicitIds.add(verifier.id);
    }
  } catch (error) {
    logger.error(
      "[Notification] Failed to load WO verifiers for stakeholders:",
      error,
    );
  }

  if (input.excludeUserId) {
    explicitIds.delete(input.excludeUserId);
  }

  return [...explicitIds].map((id) => ({ id }));
}

/** Find canvasing verifiers for one site scope. */
export async function findCanvasingVerifiers(input: {
  userLookupService: UserLookupService;
  siteId?: string | null;
}): Promise<RecipientUser[]> {
  return input.userLookupService.findManyWithCustomWhere({
    isActive: true,
    role: { permission: { some: { resource: "canvasing", action: "verify" } } },
    ...(input.siteId
      ? {
          OR: [
            { siteId: input.siteId },
            { siteId: null },
            { userSites: { some: { siteId: input.siteId } } },
          ],
        }
      : {}),
  });
}

/**
 * Pencari penerima notifikasi pengajuan upgrade paket.
 *
 * Memakai permission `pelanggan:update` — permission yang sama yang dipakai
 * route admin untuk benar-benar mengubah paket, jadi yang dinotifikasi persis
 * orang yang bisa menindaklanjutinya.
 */
export async function findPelangganManagers(input: {
  userLookupService: UserLookupService;
  siteId?: string | null;
}): Promise<RecipientUser[]> {
  return input.userLookupService.findManyWithCustomWhere({
    isActive: true,
    role: { permission: { some: { resource: "pelanggan", action: "update" } } },
    ...(input.siteId
      ? {
          OR: [
            { siteId: input.siteId },
            { siteId: null },
            { userSites: { some: { siteId: input.siteId } } },
          ],
        }
      : {}),
  });
}

/**
 * Staf yang bisa membuka halaman Transaksi Payment Gateway
 * (`payment_gateway:read`) di tenant itu: merekalah yang menindaklanjuti
 * pembayaran gateway yang tidak cocok dengan catatannya.
 */
export async function findPaymentGatewayReviewers(input: {
  userLookupService: UserLookupService;
  tenantId: string;
}): Promise<RecipientUser[]> {
  return input.userLookupService.findManyWithCustomWhere({
    isActive: true,
    tenantId: input.tenantId,
    role: {
      permission: { some: { resource: "payment_gateway", action: "read" } },
    },
  });
}

interface PoolScope {
  departmentId?: string;
  siteId?: string;
  excludeUserId?: string;
  tenantId: string | null;
}

/**
 * Tenant pagar pelebaran lintas site: tenant pemilik WO itu sendiri.
 *
 * Tidak memakai tenant konteks request: super admin bisa mengubah WO tenant
 * lain sambil sesinya membawa tenant host, sehingga verifikator tenant host
 * ikut dikabari WO tenant lain. Bila WO tidak ditemukan, hasilnya null dan
 * pemilih kembali ke syarat site lama.
 */
async function resolveWorkOrderTenantId(
  workOrderId: string | undefined,
  tenantId?: string | null,
): Promise<string | null> {
  if (tenantId) return tenantId;
  if (!workOrderId) return null;
  try {
    const workOrder = await prisma.workOrders.findUnique({
      where: { id: workOrderId },
      select: { tenantId: true },
    });
    return workOrder?.tenantId ?? null;
  } catch (error) {
    logger.error(
      "[Notification] Failed to resolve work order tenant for recipients:",
      error,
    );
    return null;
  }
}

function buildEligibleRecipientWhere(input: PoolScope): Prisma.UserWhereInput {
  // Dept matching is post-filtered (isPoolDepartmentAllowed) so multi-resource
  // department_only is accurate; Prisma where only scopes site + read.
  // Teknisi dan pembaca biasa tetap terikat site; hanya verifikator WO tanpa
  // "Batasi ke Site Sendiri" yang menerima WO baru dari semua site tenant,
  // sama seperti jalur status/update (STAKEHOLDERS).
  return {
    ...buildEligibleRecipientBaseWhere(input.excludeUserId),
    ...buildRecipientSiteScopeWhere({
      resource: WORK_ORDER_RESOURCE,
      siteId: input.siteId,
      departmentId: input.departmentId,
      tenantId: input.tenantId,
      widenOnlyWhen: WORK_ORDER_VERIFIER_WHERE,
    }),
  };
}

function buildEligibleRecipientBaseWhere(
  excludeUserId?: string,
): Prisma.UserWhereInput {
  return {
    isActive: true,
    ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    role: {
      OR: [
        {
          permission: {
            some: {
              resource: WORK_ORDER_RESOURCE,
              action: WORK_ORDER_READ_ACTION,
            },
          },
        },
        {
          permission: {
            some: {
              resource: WORK_ORDER_MOBILE_RESOURCE,
              action: WORK_ORDER_READ_ACTION,
            },
          },
        },
      ],
    },
  };
}

function hasDepartmentOnly(user: EligibleUser): boolean {
  return (
    user.role?.permission?.some(
      (permission) =>
        permission.action === WORK_ORDER_DEPARTMENT_ONLY_ACTION &&
        (permission.resource === WORK_ORDER_RESOURCE ||
          permission.resource === WORK_ORDER_MOBILE_RESOURCE),
    ) ?? false
  );
}

function hasVerifyOrApprove(user: EligibleUser): boolean {
  return (
    user.role?.permission?.some(
      (permission) =>
        (permission.resource === WORK_ORDER_RESOURCE ||
          permission.resource === WORK_ORDER_MOBILE_RESOURCE) &&
        (permission.action === "verify" ||
          permission.action === "approve_request"),
    ) ?? false
  );
}

/** Dept gate for POOL: department_only on either resource must match WO dept. */
function isPoolDepartmentAllowed(
  user: EligibleUser,
  departmentId?: string,
): boolean {
  if (!departmentId) return true;
  if (user.departmentId === departmentId) return true;
  if (user.departmentId === null) return true;
  if (hasVerifyOrApprove(user)) return true;
  if (hasDepartmentOnly(user)) return false;
  // No department_only → broad-read at site (admin-style)
  return true;
}

function isEligibleRecipient(user: EligibleUser, input: PoolScope): boolean {
  if (input.excludeUserId && user.id === input.excludeUserId) {
    return false;
  }
  if (!user.role?.permission?.length || !input.siteId) {
    return true;
  }

  const userSiteIds = user.userSites?.map((userSite) => userSite.siteId) || [];
  const isAtHomeSite =
    userSiteIds.includes(input.siteId) ||
    user.siteId === input.siteId ||
    user.siteId === null;
  return isAtHomeSite || isSiteUnrestrictedVerifier(user, input);
}

function isSiteUnrestrictedVerifier(
  user: EligibleUser,
  input: PoolScope,
): boolean {
  if (!input.tenantId) return false;
  const isVerifier =
    user.role?.permission?.some(
      (permission) =>
        permission.resource === WORK_ORDER_RESOURCE &&
        (VERIFY_ACTIONS as readonly string[]).includes(permission.action),
    ) ?? false;
  return (
    isVerifier &&
    isSiteUnrestrictedRecipient(user, {
      resource: WORK_ORDER_RESOURCE,
      departmentId: input.departmentId,
    })
  );
}

function mapRecipientUser(user: { id: string }): RecipientUser {
  return { id: user.id };
}
