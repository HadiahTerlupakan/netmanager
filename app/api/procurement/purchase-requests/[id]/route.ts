import { procurementEndpointDisabled } from "@/modules/procurement";

/**
 * GET /api/procurement/purchase-requests/[id]
 * Get Purchase Request by ID
 */
export async function GET() {
  return procurementEndpointDisabled();
}

/**
 * PATCH /api/procurement/purchase-requests/[id]
 * Update Purchase Request status (approve/reject)
 * If approved, automatically generates a Purchase Order
 */
export async function PATCH() {
  return procurementEndpointDisabled();
}
