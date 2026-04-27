import { apiSuccess, createHandler } from "@/lib/api";
import { AdminOptionsRouteService } from "@/modules/roles";

const adminOptionsRouteService = new AdminOptionsRouteService();

// GET /api/admin/options - Get dropdown options
export const GET = createHandler({ auth: true }, async () => {
  const options = await adminOptionsRouteService.getOptions();
  return apiSuccess(options);
});
