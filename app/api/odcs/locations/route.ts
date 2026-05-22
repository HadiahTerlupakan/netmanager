import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { prisma } from "@/modules/database";

export async function GET(_request: NextRequest) {
  const odcs = await prisma.odc.findMany({
    where: { location: { not: null }, status: "AKTIF" },
    select: { location: true },
    distinct: ["location"],
    orderBy: { location: "asc" },
  });

  const locations = odcs
    .map((o) => o.location)
    .filter((l): l is string => l !== null);

  return apiSuccess(locations);
}
