import { jalankanRuteInvestorMobile } from "@/lib/mobile-investor-route";
import { getInvestorPortalPayoutService } from "@/modules/investor";

/** Riwayat uang yang sudah dikirim ke investor (paginasi `page`, `limit`). */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  return jalankanRuteInvestorMobile(request, "payouts", (session) =>
    getInvestorPortalPayoutService().getPayouts(session.id, query),
  );
}
