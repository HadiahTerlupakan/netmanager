
import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authConfig);
  return NextResponse.json({
    message: "Debug Session",
    session: session,
    user: session?.user,
    isSuperAdminField: (session?.user as any)?.isSuperAdmin,
    roleField: (session?.user as any)?.role,
  });
}
