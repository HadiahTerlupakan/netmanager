import { logger } from "@/lib/logger";
import type { FetchCustomersParams } from "./mixradius-types";

/** Fetch unique owner names from customer dataset. */
export async function fetchMixRadiusUniqueOwners(params: {
  fetchCustomersPPP: (
    filters: FetchCustomersParams,
  ) => Promise<{ data: Array<{ owner_name: string }> }>;
}): Promise<string[]> {
  try {
    const result = await params.fetchCustomersPPP({
      start: 0,
      length: 10000,
    });
    return extractUniqueOwners(result.data);
  } catch (error) {
    logger.error(
      "[MixRadius] Get owners error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function extractUniqueOwners(data: Array<{ owner_name: string }> | undefined) {
  const ownerNames = data?.map((item) => item.owner_name).filter(Boolean) || [];
  return Array.from(new Set(ownerNames)).sort();
}
