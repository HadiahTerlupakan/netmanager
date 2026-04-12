import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { CustomerDashboardService } from "@/modules/pelanggan";

const dashboardService = new CustomerDashboardService();

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const result = await dashboardService.getDashboardData({
      customerId: authResult.session.id,
    });

    return apiSuccess({
      profile: result.profile,
      connection: result.connection,
      billing: result.billing,
    });
  } catch (error) {
    console.error("[Customer Dashboard Summary GET Error]:", error);

    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan server";
    if (message === "Data pelanggan tidak ditemukan") {
      return ApiErrors.notFound("Pelanggan");
    }

    return ApiErrors.internalError(message);
  }
}
