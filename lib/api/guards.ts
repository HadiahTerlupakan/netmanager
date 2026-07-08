import { getMitraService } from "@/modules/mitra";
import { checkSiteRestriction } from "@/modules/roles";

type UserScope = { id: string; name?: string; tenantId?: string | null };

/** Ensure the mitra belongs to the current user's site scope. */
export async function ensureMitraInScope(
  mitraId: string,
  user: UserScope,
): Promise<{ allowed: boolean; error?: string }> {
  const tenantId = user.tenantId ?? undefined;
  const mitra = await getMitraService().getMitraById(mitraId, tenantId);
  if (!mitra.success) {
    return { allowed: false, error: "Mitra tidak ditemukan" };
  }

  const { isRestricted, siteIds } = checkSiteRestriction(
    { user } as never,
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
  newSiteId?: string,
): { valid: boolean; error?: string } {
  if (!newSiteId) return { valid: true };
  const { isRestricted, siteIds } = checkSiteRestriction(
    { user } as never,
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
