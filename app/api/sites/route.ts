import { NextResponse } from "next/server";
import { getHybridUser } from "@/lib/hybrid-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const user = await getHybridUser(req);

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const sites = await prisma.sites.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json({ sites });
  } catch (error) {
    console.error("[SITES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
