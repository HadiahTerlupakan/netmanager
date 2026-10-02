import { jalankanRuteInvestorMobile } from "@/lib/mobile-investor-route";
import { getInvestorPortalProjectService } from "@/modules/investor";

/** Daftar proyek tempat investor menanam modal. */
export async function GET(request: Request) {
  return jalankanRuteInvestorMobile(request, "projects", (session) =>
    getInvestorPortalProjectService().getProjects(session.id, session.tenantId),
  );
}
