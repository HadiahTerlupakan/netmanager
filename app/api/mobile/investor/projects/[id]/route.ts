import { jalankanRuteInvestorMobile } from "@/lib/mobile-investor-route";
import { getInvestorPortalProjectService } from "@/modules/investor";

/** Rincian satu proyek milik investor; 404 bila bukan proyeknya. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return jalankanRuteInvestorMobile(request, "project detail", (session) =>
    getInvestorPortalProjectService().getProjectDetail(
      id,
      session.id,
      session.tenantId,
    ),
  );
}
