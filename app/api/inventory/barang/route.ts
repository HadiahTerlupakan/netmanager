import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  inventoryBarangRouteService,
  type InventoryBarangRouteResult,
} from "@/modules/inventory";
import { logger } from "@/lib/logger";
import { parsePaginationParams } from "@/lib/utils/pagination";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

type InventoryBarangRouteFailure<T> = Extract<
  InventoryBarangRouteResult<T>,
  { success: false }
>;

function isInventoryBarangRouteFailure<T>(
  result: InventoryBarangRouteResult<T>,
): result is InventoryBarangRouteFailure<T> {
  return !result.success;
}

/**
 * @swagger
 * /api/inventory/barang:
 *   get:
 *     summary: Get all inventory items
 *     description: Retrieve a list of all inventory items with stock information per warehouse
 *     tags: [Inventory Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: gudangId
 *         schema:
 *           type: integer
 *         description: Filter by warehouse ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in item code and name
 *     responses:
 *       200:
 *         description: Successfully retrieved inventory items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 barangs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Barang'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 *
 *   post:
 *     summary: Create a new inventory item
 *     description: Add a new item to the inventory system
 *     tags: [Inventory Management]
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
 *               - satuan
 *             properties:
 *               nama:
 *                 type: string
 *                 description: Item name
 *                 example: "Fiber Optic Cable"
 *               satuan:
 *                 type: string
 *                 description: Unit of measurement
 *                 example: "meter"
 *               kode:
 *                 type: string
 *                 description: Item code (optional, will be auto-generated if not provided)
 *                 example: "FOC-001"
 *               deskripsi:
 *                 type: string
 *                 description: Item description
 *                 example: "Single mode fiber optic cable for FTTH"
 *               kategori:
 *                 type: string
 *                 description: Item category
 *                 example: "Cable"
 *               merek:
 *                 type: string
 *                 description: Brand/manufacturer
 *                 example: "Corning"
 *               hargaBeli:
 *                 type: number
 *                 format: decimal
 *                 description: Purchase price per unit
 *                 example: 50000
 *               hargaJual:
 *                 type: number
 *                 format: decimal
 *                 description: Selling price per unit
 *                 example: 75000
 *               stokMinimum:
 *                 type: integer
 *                 minimum: 0
 *                 description: Minimum stock level for alerts
 *                 example: 100
 *               foto:
 *                 type: string
 *                 format: uri
 *                 description: Item photo URL
 *                 example: "https://example.com/photos/fiber-cable.jpg"
 *     responses:
 *       201:
 *         description: Successfully created inventory item
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: Created item ID
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "Item created successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("barang:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat barang",
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const gudangId = searchParams.get("gudangId");
  const search = searchParams.get("search");
  const { page, limit } = parsePaginationParams(searchParams, {
    page: 1,
    limit: 10,
  });

  try {
    const dbStart = Date.now();

    const permissions = await getUserPermissions(user.id);
    const result = await inventoryBarangRouteService.listBarang({
      userId: user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(user),
      search,
      gudangId,
      page,
      limit,
    });

    logger.dbOperation("findMany", "Barang+BarangGudang", Date.now() - dbStart);

    logger.apiRequest(
      "GET",
      "/api/inventory/barang",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        barangCount: result.barangs.length,
        page,
        limit,
        total: result.pagination.total,
        gudangId,
        search,
      },
    );

    return apiSuccess(result);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching barangs", err, {
      path: "/api/inventory/barang",
      method: "GET",
    });
    throw error; // Let createHandler handle it
  }
});

/**
 * POST /api/inventory/barang
 * Create new item
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("barang:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat barang",
    );
  }

  const body = await req.json();

  try {
    const dbStart = Date.now();
    const result = await inventoryBarangRouteService.createBarang({
      userId: user.id,
      body,
    });

    if (isInventoryBarangRouteFailure(result)) {
      return ApiErrors.badRequest(result.error);
    }

    logger.dbOperation("create", "Barang", Date.now() - dbStart);

    logger.apiRequest(
      "POST",
      "/api/inventory/barang",
      201,
      Date.now() - startTime,
      {
        userId: user.id,
        barangId: result.data.barang.id,
        kode: result.data.barang.kode,
      },
    );

    return apiSuccess(result.data, {
      status: 201,
      message: result.message,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error creating barang", err, {
      path: "/api/inventory/barang",
      method: "POST",
    });
    const message =
      error instanceof Error ? error.message : "Gagal membuat barang";
    return ApiErrors.internalError(message);
  }
});
