import { apiSuccess, createHandler } from "@/lib/api";
import { LandingContentService } from "@/modules/website";

const service = new LandingContentService();

export const GET = createHandler({ auth: false }, async () => {
  const content = await service.getAllContent();
  return apiSuccess(content, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
});
