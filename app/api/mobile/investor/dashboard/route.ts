import { jalankanRuteInvestorMobile } from "@/lib/mobile-investor-route";
import { getInvestorPortalKeuanganService } from "@/modules/investor";

/** Ringkasan Beranda investor: proyek, saldo modal, bagi hasil menunggu dibayar. */
export async function GET(request: Request) {
  return jalankanRuteInvestorMobile(request, "dashboard", (session) =>
    getInvestorPortalKeuanganService().getRingkasan(session.id, session.tenantId),
  );
}
