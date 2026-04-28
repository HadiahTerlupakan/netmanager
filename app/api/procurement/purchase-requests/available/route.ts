import { procurementEndpointDisabled } from "@/modules/procurement";

export async function GET() {
  return procurementEndpointDisabled();
}
