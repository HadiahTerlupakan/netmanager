
import { NextRequest } from "next/server";
import { MappingService } from "@/lib/services/MappingService";
import { apiSuccess, ApiErrors, withErrorHandler } from "@/lib/api-response";
import { z } from "zod";

const service = new MappingService();

// Schema Validation
const createNodeSchema = z.object({
  type: z.enum(['olt', 'odc', 'odp', 'ont']),
  name: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  capacity: z.number().default(0),
  splitter: z.string().optional(),
  pppoe: z.string().optional(),
  serialNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const GET = withErrorHandler(async () => {
  const nodes = await service.getNodes();
  return apiSuccess(nodes);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  
  // Validation
  const validation = createNodeSchema.safeParse(body);
  if (!validation.success) {
    return ApiErrors.badRequest("Validation failed", validation.error.format());
  }

  const newNode = await service.createNode({
    nodeId: crypto.randomUUID(), // Manual UUID since schema might not auto-gen if we didn't use @default(uuid) on nodeId (Wait, let's check schema. Ah, schema has nodeId String @id, usually we need to provide it or use default. My schema has @map("node_id") but no @default(uuid()). I should provide it or update schema. Let's provide it for now to be safe, or update schema to @default(uuid()). The provided schema in guide had manually assigned IDs like 'odc-jakarta-1', so manual is better.)
    ...validation.data
  });
  
  return apiSuccess(newNode, { status: 201 });
});
