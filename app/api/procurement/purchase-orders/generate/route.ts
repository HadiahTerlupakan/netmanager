import { procurementEndpointDisabled } from "@/modules/procurement";

export async function POST() {
  return procurementEndpointDisabled();
}
