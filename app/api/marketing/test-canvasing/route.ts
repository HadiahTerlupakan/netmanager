import { NextResponse } from "next/server";
import { TestCanvasingRouteService } from "@/modules/marketing";

const service = new TestCanvasingRouteService();

/** Return sample canvasing data for the test route. */
export async function GET() {
  const canvasing = await service.getLatestCanvasing();
  return NextResponse.json({ data: canvasing });
}
