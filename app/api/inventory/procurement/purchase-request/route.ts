import { procurementEndpointDisabled } from "@/modules/procurement";

/**
 * POST /api/inventory/procurement/purchase-request
 * Create a new Purchase Request from Restock Alerts
 */
export async function POST() {
  return procurementEndpointDisabled();
}
