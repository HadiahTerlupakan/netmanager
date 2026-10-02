import { NextRequest } from "next/server";

import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { getInvestorMobileSession } from "@/lib/mobile-investor-auth";
import { getMobileInvestorAuthService } from "@/modules/investor";
import { getMobileEmployeeMe } from "@/modules/users";
import { getMobileMitraMe } from "@/modules/mitra";
import { getUserFeaturesWithCanvasing } from "@/modules/marketing";

/** Mengambil identitas pengguna mobile yang sedang login. */
export async function GET(req: NextRequest) {
  try {
    const investorSession = await getInvestorMobileSession(req);
    if (investorSession) {
      const investor = await getMobileInvestorAuthService().getProfile(
        investorSession.id,
      );
      return investor ? apiSuccess(investor) : ApiErrors.notFound("Investor");
    }

    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof Response) return authResult;

    const session = authResult;
    if (session.role === "MITRA") {
      const mitra = await getMobileMitraMe(session.id);
      if (!mitra) {
        return ApiErrors.notFound("Mitra");
      }

      return apiSuccess(mitra);
    }

    const user = await getMobileEmployeeMe(session.id, session.role);
    if (!user) {
      return ApiErrors.notFound("User");
    }

    return apiSuccess({
      ...user,
      features: await getUserFeaturesWithCanvasing(session.id),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal mengambil profile";
    return ApiErrors.internalError(message);
  }
}
