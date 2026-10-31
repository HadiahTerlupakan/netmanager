import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { HealthCheckRouteService } from "@/modules/network";
import { isSandboxGatewayLive } from "@/modules/payment-gateway/api";

const healthCheckRouteService = new HealthCheckRouteService();

/**
 * Ambil status health aplikasi untuk public dan internal monitoring.
 * Gateway sandbox hanya ditandai di jawaban internal: penanda publik memberi
 * tahu siapa pun bahwa tagihan bisa "dilunasi" dari halaman demo sandbox.
 */
export async function GET(request: NextRequest) {
  const health = await healthCheckRouteService.getHealth();
  const statusCode = health.status === "healthy" ? 200 : 503;
  const internalSecret = request.headers.get("x-internal-request");
  const expectedSecret = process.env.INTERNAL_HEALTH_SECRET;

  if (expectedSecret && internalSecret === expectedSecret) {
    const paymentGateway = { sandboxInProduction: await checkSandbox() };
    return apiSuccess({ ...health, paymentGateway }, { status: statusCode });
  }

  return apiSuccess(
    {
      status: health.status === "healthy" ? "ok" : "error",
      timestamp: new Date().toISOString(),
    },
    { status: statusCode },
  );
}

// Pemeriksaan tambahan tidak boleh menggagalkan health check; null berarti
// tidak diketahui.
async function checkSandbox(): Promise<boolean | null> {
  try {
    return await isSandboxGatewayLive(null);
  } catch (error) {
    logger.warn("[Health] Gagal memeriksa gateway sandbox:", error);
    return null;
  }
}
