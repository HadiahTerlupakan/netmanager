import { RadiusSyncService } from "@/modules/network";

import { findPelangganForLifecycle } from "./pelanggan-ppp-route-queries";
import { RouteServiceError } from "./pelanggan-ppp-route-validation";
import {
  DEFAULT_PAGE,
  MAX_LIMIT,
  mapRadiusHistoryItem,
  type ParsedDateRange,
  type UsageCustomerRecord,
  type UsageSource,
} from "./pelanggan-ppp-route-helpers";

export async function requireLifecycleCustomer(
  id: string,
  action: "activate" | "suspend",
) {
  const pelanggan = await findPelangganForLifecycle(id);
  if (!pelanggan) {
    throw new RouteServiceError("Customer not found", 404);
  }

  if (action === "suspend" && pelanggan.status === "NONAKTIF") {
    throw new RouteServiceError("Customer is already suspended", 400);
  }

  if (action === "activate" && pelanggan.status !== "NONAKTIF") {
    throw new RouteServiceError("Customer is not currently suspended", 400);
  }

  return pelanggan;
}

export async function getFirstActiveSession(
  radiusService: Pick<
    RadiusSyncService,
    "getCustomerActiveSessions" | "getCustomerSessionHistory"
  >,
  pelanggan: UsageCustomerRecord,
) {
  const activeSessions = await radiusService.getCustomerActiveSessions(
    pelanggan.username,
    pelanggan.tenantId,
  );
  return activeSessions[0] ?? null;
}

export async function getRadiusHistory(
  radiusService: Pick<
    RadiusSyncService,
    "getCustomerActiveSessions" | "getCustomerSessionHistory"
  >,
  pelanggan: UsageCustomerRecord,
  source: UsageSource,
  dateRange: ParsedDateRange,
) {
  if (source === "database") return [];

  const radiusSessions = await radiusService.getCustomerSessionHistory(
    pelanggan.username,
    pelanggan.tenantId,
    {
      page: DEFAULT_PAGE,
      limit: MAX_LIMIT,
      ...(dateRange.startDate ? { startDate: dateRange.startDate } : {}),
      ...(dateRange.endDate ? { endDate: dateRange.endDate } : {}),
    },
  );

  return radiusSessions.sessions.map(mapRadiusHistoryItem);
}
