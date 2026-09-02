import { prismaAuth } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/auth/super-admin";
import { GRANULAR_PERMISSIONS } from "@/lib/permission-config";

/** Ditolak saat aktor mencoba memberikan role setingkat super admin. */
export class RoleAssignmentForbiddenError extends Error {
  constructor(
    message = "Anda tidak berwenang memberikan role super admin",
    readonly status = 403,
  ) {
    super(message);
    this.name = "RoleAssignmentForbiddenError";
  }
}

type TargetRole = {
  name?: string | null;
  isSuperAdmin?: boolean | null;
} | null;

/**
 * Menjaga pemberian role setingkat super admin ke seorang user.
 *
 * `users:assign_super_admin` sudah lama didefinisikan di `permission-config`
 * dan ikut di-seed, tapi tidak pernah ditegakkan di mana pun: `roleId` mengalir
 * dari body request langsung ke `data.roleId`. Akibatnya pemegang
 * `users:create` bisa membuat akun dengan roleId milik role super admin lalu
 * login sebagai super admin.
 *
 * Status super admin diperiksa dari DUA arah — flag `isSuperAdmin` dan nama
 * role yang cocok `isSuperAdminRole()` — karena keduanya sama-sama dipakai
 * sebagai sumber kewenangan di lapisan auth.
 */
export function assertCanAssignRole(options: {
  targetRole: TargetRole;
  actorPermissions: string[];
  actorIsSuperAdmin?: boolean;
}): void {
  if (!grantsSuperAdmin(options.targetRole)) {
    return;
  }

  if (options.actorIsSuperAdmin) {
    return;
  }

  const permissions = options.actorPermissions ?? [];
  const isAllowed =
    permissions.includes("*") ||
    permissions.includes(GRANULAR_PERMISSIONS.USERS_ASSIGN_SUPER_ADMIN);

  if (!isAllowed) {
    throw new RoleAssignmentForbiddenError();
  }
}

function grantsSuperAdmin(role: TargetRole): boolean {
  if (!role) return false;
  return Boolean(role.isSuperAdmin) || isSuperAdminRole(role.name);
}

/**
 * Memuat lalu memeriksa role tujuan sebelum diberikan ke seorang user.
 * Tidak melakukan apa-apa bila roleId tidak disertakan pada request.
 */
export async function assertCanAssignRoleId(options: {
  roleId?: string | null;
  actorPermissions: string[];
  actorIsSuperAdmin?: boolean;
}): Promise<void> {
  if (!options.roleId) {
    return;
  }

  const targetRole = await prismaAuth.role.findUnique({
    where: { id: options.roleId },
    select: { name: true, isSuperAdmin: true },
  });

  assertCanAssignRole({
    targetRole,
    actorPermissions: options.actorPermissions,
    actorIsSuperAdmin: options.actorIsSuperAdmin,
  });
}
