import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  getDefaultProcessAbsenceDate,
  runProcessAbsenceCron,
} from "@/modules/attendance";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const env = getEnv();
    const headersList = await headers();
    const authHeader = headersList.get("authorization");

    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    const result = await runProcessAbsenceCron({
      targetDate: await resolveTargetDate(request),
    });

    if (result.status === "unavailable") {
      return NextResponse.json(result.payload, { status: 503 });
    }

    return NextResponse.json(result.payload);
  } catch (error: unknown) {
    logger.error("Error processing absence:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}

async function resolveTargetDate(request: Request) {
  try {
    const body = await request.json();
    return body.date ? new Date(body.date) : getDefaultProcessAbsenceDate();
  } catch (_error) {
    return getDefaultProcessAbsenceDate();
  }
}

export async function GET(request: Request) {
  return POST(request);
}
