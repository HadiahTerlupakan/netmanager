import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  PlanningItemRepository,
  PlanningRepository,
  createPlanningItemSchema,
  PlanningItemMapper,
} from "@/modules/planning";
import { logger } from "@/lib/logger";

const itemRepo = new PlanningItemRepository();
const planningRepo = new PlanningRepository();

/**
 * GET /api/planning/[id]/items
 * List all items for a planning
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning.read"],
  },
  async (req, ctx) => {
    const { id } = ctx.params;

    // Verify planning exists
    const planning = await planningRepo.findById(id);
    if (!planning) {
      return ApiErrors.notFound("Planning tidak ditemukan");
    }

    // Get all items for this planning
    const items = await itemRepo.findByPlanningId(id);

    // Convert to DTOs
    const dtos = items.map((item) => PlanningItemMapper.toDTO(item));

    return apiSuccess(dtos);
  },
);

/**
 * POST /api/planning/[id]/items
 * Add new item to planning
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["planning.update"],
    schema: createPlanningItemSchema,
  },
  async (req, ctx) => {
    const { id } = ctx.params;
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session?.user?.tenantId;

    if (!tenantId) {
      return ApiErrors.badRequest("Tenant ID required");
    }

    // Verify planning exists
    const planning = await planningRepo.findById(id);
    if (!planning) {
      return ApiErrors.notFound("Planning tidak ditemukan");
    }

    // Check if planning can be edited
    if (!planning.canBeEdited()) {
      return ApiErrors.badRequest(
        `Cannot add items to planning in status ${planning.status}. Only BACKLOG or REJECTED status can be edited.`,
      );
    }

    // Create item
    const item = await itemRepo.create({
      planningId: id,
      tenantId,
      name: ctx.validated.name,
      description: ctx.validated.description ?? null,
      quantity: ctx.validated.quantity,
      unit: ctx.validated.unit,
      estimatedPrice: ctx.validated.estimatedPrice ?? null,
      notes: ctx.validated.notes ?? null,
    });

    // Activity log
    logger.logActivity({
      action: "planning.item_added",
      subject: "PlanningItem",
      details: {
        planningId: id,
        itemId: item.id,
        itemName: item.name,
      },
      userId,
      tenantId,
    });

    // Convert to DTO
    const dto = PlanningItemMapper.toDTO(item);

    return apiSuccess(dto, {
      status: 201,
      message: "Item berhasil ditambahkan",
    });
  },
);
