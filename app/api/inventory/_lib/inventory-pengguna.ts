import { isSuperAdmin } from "@/lib/auth";

/** Konteks `createHandler` yang dibutuhkan untuk pemeriksaan lingkup site. */
interface InventoryHandlerContext {
  session: {
    user: { id: string; role?: string; isSuperAdmin?: boolean };
  } | null;
  permissions: string[];
}

/**
 * Identitas akses pengguna dari konteks `createHandler`: id, permission dari
 * `ctx.permissions` (objek user sesi tidak membawanya), dan status super admin.
 */
export function resolvePenggunaInventory(ctx: InventoryHandlerContext) {
  const user = ctx.session!.user;
  return {
    userId: user.id,
    permissions: ctx.permissions,
    isSuperAdmin: isSuperAdmin(user),
  };
}
