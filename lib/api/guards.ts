import { getMitraService } from "@/modules/mitra";
import { checkSiteRestriction } from "@/modules/roles";

import { buildSessionWithPermissions } from "./build-session-with-permissions";
import type { HandlerContext } from "./handler";

type UserScope = { id: string; name?: string; tenantId?: string | null };

/**
 * `checkSiteRestriction` membaca `session.user.permissions`, sedangkan sesi
 * `createHandler` menyimpan permissions terpisah di `ctx.permissions`. Helper di
 * berkas ini karena itu menerima `permissions` secara eksplisit: sebelumnya ia
 * mengoper `{ user } as never`, sehingga daftar permission selalu kosong dan
 * pembatasan `mitra:site_only` tidak pernah berlaku.
 */
function sessionFor(user: UserScope, permissions: string[]) {
  return buildSessionWithPermissions(
    { user } as unknown as NonNullable<HandlerContext["session"]>,
    permissions,
  );
}

/** Ensure the mitra belongs to the current user's site scope. */
export async function ensureMitraInScope(
  mitraId: string,
  user: UserScope,
  permissions: string[],
): Promise<{ allowed: boolean; error?: string }> {
  const tenantId = user.tenantId ?? undefined;
  const mitra = await getMitraService().getMitraById(mitraId, tenantId);
  if (!mitra.success) {
    return { allowed: false, error: "Mitra tidak ditemukan" };
  }

  const { isRestricted, siteIds } = checkSiteRestriction(
    sessionFor(user, permissions),
    "mitra",
  );
  if (!isRestricted) return { allowed: true };

  if (!mitra.data.siteId || !siteIds.includes(mitra.data.siteId)) {
    return {
      allowed: false,
      error: "Anda tidak dapat mengakses mitra di luar scope Anda",
    };
  }

  return { allowed: true };
}

/** Ensure the target site belongs to the current user's mitra scope. */
export function ensureSiteIdInScope(
  user: UserScope,
  permissions: string[],
  newSiteId?: string,
): { valid: boolean; error?: string } {
  if (!newSiteId) return { valid: true };
  const { isRestricted, siteIds } = checkSiteRestriction(
    sessionFor(user, permissions),
    "mitra",
  );
  if (isRestricted && !siteIds.includes(newSiteId)) {
    return {
      valid: false,
      error: "Anda tidak dapat memindahkan mitra ke site di luar scope Anda",
    };
  }

  return { valid: true };
}
