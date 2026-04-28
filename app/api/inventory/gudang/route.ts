import { logger } from "@/lib/logger";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  inventoryGudangRouteService,
  type InventoryGudangRouteResult,
} from "@/modules/inventory";
import { logActivitySafe } from "@/lib/logger";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

type InventoryGudangRouteFailure = Extract<
  InventoryGudangRouteResult<unknown>,
  { success: false }
>;

function isInventoryGudangRouteFailure(
  result: InventoryGudangRouteResult<unknown>,
): result is InventoryGudangRouteFailure {
  return !result.success;
}

/**
 * @swagger
 * /api/inventory/gudang:
 *   get:
 *     summary: Get all warehouses
 *     description: Retrieve a list of all active warehouses in the inventory system
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of warehouses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gudangs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Gudang'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("gudang:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const { searchParams } = req.nextUrl;
  const viewAll = searchParams.get("view") === "all";
  const permissions = await getUserPermissions(user.id);

  try {
    const dbStart = Date.now();
    const gudangs = await inventoryGudangRouteService.listGudang({
      userId: user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(user),
      viewAll,
    });

    logger.dbOperation("findMany", "Gudang", Date.now() - dbStart);

    logger.apiRequest(
      "GET",
      "/api/inventory/gudang",
      200,
      Date.now() - startTime,
      {
        gudangCount: gudangs.length,
        userId: user.id,
      },
    );

    return apiSuccess({ gudangs });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching gudangs", err, {
      path: "/api/inventory/gudang",
      method: "GET",
    });
    throw error; // Let createHandler handle it
  }
});

/**
 * @swagger
 * /api/inventory/gudang:
 *   post:
 *     summary: Create new warehouse
 *     description: Add a new warehouse to the inventory system
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nama
 *             properties:
 *               nama:
 *                 type: string
 *                 description: Warehouse name
 *                 example: "Gudang Utama"
 *               lokasi:
 *                 type: string
 *                 description: Warehouse location
 *                 example: "Jakarta Pusat"
 *                 nullable: true
 *               isActive:
 *                 type: boolean
 *                 description: Whether the warehouse is active
 *                 default: true
 *     responses:
 *       201:
 *         description: Warehouse created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gudang:
 *                   $ref: '#/components/schemas/Gudang'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("gudang:create"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const body = await req.json();
  const permissions = await getUserPermissions(user.id);

  try {
    const dbStart = Date.now();
    const result = await inventoryGudangRouteService.createGudang({
      userId: user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(user),
      body,
    });

    if (isInventoryGudangRouteFailure(result)) {
      return ApiErrors.badRequest(result.error);
    }

    const gudang = result.data as { id: string; kode: string; nama: string };

    logger.dbOperation("create", "Gudang", Date.now() - dbStart);

    logger.apiRequest(
      "POST",
      "/api/inventory/gudang",
      201,
      Date.now() - startTime,
      {
        gudangId: gudang.id,
        kode: gudang.kode,
        userId: user.id,
      },
    );

    // System Log
    logActivitySafe({
      action: "CREATE",
      subject: "Gudang",
      details: { id: gudang.id, name: gudang.nama, code: gudang.kode },
      userId: user.id,
    });

    return apiSuccess({ gudang }, { status: 201 });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error creating gudang", err, {
      path: "/api/inventory/gudang",
      method: "POST",
    });
    return ApiErrors.internalError("Gagal membuat gudang");
  }
});
