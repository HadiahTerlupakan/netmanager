import { createHandler, apiSuccess } from "@/lib/api";
import { MappingService } from "@/modules/map/services/MappingService";

const service = new MappingService();

/**
 * @swagger
 * /api/map/statistics:
 *   get:
 *     summary: Get map statistics
 *     tags: [Map]
 */
export const GET = createHandler({
  auth: true,
  permissions: ["map:read"]
}, async () => {
  const stats = await service.getStatistics();
  return apiSuccess(stats);
});
