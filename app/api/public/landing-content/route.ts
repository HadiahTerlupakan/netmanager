import { NextRequest, NextResponse } from "next/server";
import { LandingContentService } from "@/modules/website";

const service = new LandingContentService();

export async function GET(_request: NextRequest) {
  const content = await service.getAllContent();

  return NextResponse.json(
    { success: true, data: content },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
