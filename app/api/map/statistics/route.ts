import { MappingService } from "@/lib/services/MappingService";
import { apiSuccess, withErrorHandler } from "@/lib/api-response";

const service = new MappingService();

export const GET = withErrorHandler(async () => {
  const stats = await service.getStatistics();
  return apiSuccess(stats);
});
