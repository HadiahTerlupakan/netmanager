import { jalankanRuteInvestorMobile } from "@/lib/mobile-investor-route";
import { getInvestorPortalKeuanganService } from "@/modules/investor";

/** Riwayat setoran modal investor. */
export async function GET(request: Request) {
  return jalankanRuteInvestorMobile(request, "deposits", (session) =>
    getInvestorPortalKeuanganService().getDeposits(session.id),
  );
}
