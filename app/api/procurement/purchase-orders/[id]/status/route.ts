import { procurementEndpointDisabled } from "@/modules/procurement";

export async function PATCH() {
  return procurementEndpointDisabled();
}
