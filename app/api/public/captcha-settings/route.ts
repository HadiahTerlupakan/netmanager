import { NextResponse } from "next/server";
import { getPublicCaptchaSettings } from "@/modules/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getPublicCaptchaSettings());
  } catch (error) {
    console.error("Error fetching public captcha settings:", error);
    return NextResponse.json({ enabled: false, siteKey: "" });
  }
}
