import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { HealthCheckRouteService } from "@/modules/network";

const healthCheckRouteService = new HealthCheckRouteService();

/** Ambil status health aplikasi untuk public dan internal monitoring. */
export async function GET(request: NextRequest) {
  const health = await healthCheckRouteService.getHealth();
  const statusCode = health.status === "healthy" ? 200 : 503;
  const internalSecret = request.headers.get("x-internal-request");
  const expectedSecret = process.env.INTERNAL_HEALTH_SECRET;

  if (expectedSecret && internalSecret === expectedSecret) {
    return apiSuccess(health, { status: statusCode });
  }

  return apiSuccess(
    {
      status: health.status === "healthy" ? "ok" : "error",
      timestamp: new Date().toISOString(),
    },
    { status: statusCode },
  );
}
