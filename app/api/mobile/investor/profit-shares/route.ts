import { jalankanRuteInvestorMobile } from "@/lib/mobile-investor-route";
import { getInvestorPortalKeuanganService } from "@/modules/investor";

/** Riwayat bagi hasil investor per periode. */
export async function GET(request: Request) {
  return jalankanRuteInvestorMobile(request, "profit-shares", (session) =>
    getInvestorPortalKeuanganService().getProfitShares(session.id),
  );
}
