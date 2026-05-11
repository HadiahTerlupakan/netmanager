import { NextResponse } from "next/server";
import { getMitraService } from "@/modules/mitra";
import { checkSiteRestriction } from "@/modules/roles";

function getMitraRouteService() {
  return getMitraService();
}

export async function validateMitraSiteAccess(
  mitraId: string,
  user: { id?: string; name?: string | null },
): Promise<{ allowed: boolean; error?: string }> {
  if (!user.id) return { allowed: false, error: "User ID required" };

  const { isRestricted, siteIds } = checkSiteRestriction(
    { user } as never,
    "mitra",
  );
  if (!isRestricted) return { allowed: true };

  const mitra = await getMitraRouteService().getMitraById(mitraId);
  if (!mitra.success) return { allowed: false, error: "Mitra tidak ditemukan" };

  if (!mitra.data.siteId || !siteIds.includes(mitra.data.siteId)) {
    return {
      allowed: false,
      error: "Anda tidak dapat mengakses mitra di luar scope Anda",
    };
  }

  return { allowed: true };
}

export async function validateNewSiteId(
  user: { id?: string; name?: string | null },
  newSiteId?: string,
): Promise<{ valid: boolean; error?: string }> {
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

export function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
    { status: 403 },
  );
}

export function accessDeniedResponse(error?: string) {
  return NextResponse.json(
    { success: false, error: error || "Access denied" },
    { status: 403 },
  );
}

export function notFoundResponse(error: string) {
  return NextResponse.json({ success: false, error }, { status: 404 });
}

export function badRequestResponse(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

export function successResponse(data?: unknown) {
  return NextResponse.json({ success: true, ...(data ? { data } : {}) });
}

export const mitraService = {
  getMitraById: (
    ...args: Parameters<ReturnType<typeof getMitraRouteService>["getMitraById"]>
  ) => getMitraRouteService().getMitraById(...args),
  updateMitra: (
    ...args: Parameters<ReturnType<typeof getMitraRouteService>["updateMitra"]>
  ) => getMitraRouteService().updateMitra(...args),
  deleteMitra: (
    ...args: Parameters<ReturnType<typeof getMitraRouteService>["deleteMitra"]>
  ) => getMitraRouteService().deleteMitra(...args),
};
