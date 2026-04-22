import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { InventoryRepository } from "@/modules/inventory";
import { logger, logActivitySafe } from "@/lib/logger";
import { validateGudangSiteAccess } from "@/modules/inventory";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import type { Session } from "next-auth";

/**
 * @swagger
 * /api/inventory/masuk:
 *   get:
 *     summary: Get all stock-in movements with filters
 *     tags: [Inventory]
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("masuk:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat barang masuk",
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const barangId = searchParams.get("barangId") || undefined;
  const gudangId = searchParams.get("gudangId") || undefined;
  const search = searchParams.get("search") || undefined;
  let siteId = searchParams.get("siteId") || undefined;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  // SITE RESTRICTION
  const permissions = await getUserPermissions(user.id);
  const isSuper = isSuperAdmin(user);

  if (
    !isSuper &&
    (permissions.includes("masuk:site_only") ||
      permissions.includes("k_barang:site_only"))
  ) {
    const { prisma } = await import("@/modules/database");
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { siteId: true },
    });
    siteId = dbUser?.siteId || undefined;
  }

  try {
    const dbStart = Date.now();

    const inventoryRepository = new InventoryRepository();

    const { items: masukList, total } =
      await inventoryRepository.getHistoryMasuk({
        skip: offset,
        take: limit,
        ...(barangId && { barangId }),
        ...(gudangId && { gudangId }),
        ...(search && { search }),
        ...(siteId && { siteId }),
      });

    logger.dbOperation(
      "findMany",
      "BarangMasuk+Relations",
      Date.now() - dbStart,
    );

    logger.apiRequest(
      "GET",
      "/api/inventory/masuk",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        count: masukList.length,
        page,
        limit,
        total,
        barangId,
        gudangId,
      },
    );

    return apiSuccess({
      masukList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching barang masuk", err, {
      path: "/api/inventory/masuk",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat data barang masuk");
  }
});

/**
 * @swagger
 * /api/inventory/masuk:
 *   post:
 *     summary: Record new stock-in movement
 *     tags: [Inventory]
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("masuk:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat barang masuk",
    );
  }

  const body = await req.json();
  const {
    barangId,
    gudangId,
    jumlah,
    kondisi,
    keterangan,
    fotoBukti,
    fotoMetadata,
  } = body;

  // Validation
  const parsedJumlah = Number(jumlah);

  if (
    !barangId ||
    !gudangId ||
    !jumlah ||
    isNaN(parsedJumlah) ||
    parsedJumlah <= 0
  ) {
    return ApiErrors.badRequest(
      "Barang, gudang, dan jumlah harus diisi dengan benar",
    );
  }

  const validConditions = ["BARU", "BEKAS", "RUSAK"];
  if (kondisi && !validConditions.includes(kondisi)) {
    return ApiErrors.badRequest(
      "Kondisi tidak valid. Pilih: BARU, BEKAS, atau RUSAK",
    );
  }

  // Validate photo data if provided
  if (fotoBukti && !Array.isArray(fotoBukti)) {
    return ApiErrors.badRequest("fotoBukti harus berupa array URL foto");
  }

  if (fotoMetadata && typeof fotoMetadata !== "object") {
    return ApiErrors.badRequest("fotoMetadata harus berupa object JSON");
  }

  // Fetch full user to mock session
  const { prisma } = await import("@/modules/database");
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { siteId: true, role: true },
  });

  const mockSession = {
    user: {
      ...user,
      siteId: dbUser?.siteId,
      role: dbUser?.role || user.role,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  const access = await validateGudangSiteAccess(
    mockSession as Session,
    gudangId,
  );
  if (!access.allowed) {
    return ApiErrors.forbidden(
      access.error || "Anda tidak memiliki akses ke gudang ini",
    );
  }

  try {
    const inventoryRepository = new InventoryRepository();
    const dbStart = Date.now();

    // Use repository to add stock
    const masukRecord = await inventoryRepository.addStock({
      barangId,
      gudangId,
      jumlah: parsedJumlah,
      kondisi: kondisi || "BARU",
      keterangan,
      userId: user.id,
      fotoBukti: fotoBukti || [],
      fotoMetadata: fotoMetadata || null,
      tanggal: new Date(),
    });

    // Get updated stock level for WebSocket broadcast
    const finalStock = await inventoryRepository.getStockLevel(
      barangId,
      gudangId,
    );

    logger.dbOperation(
      "transaction",
      "BarangMasuk+BarangGudang",
      Date.now() - dbStart,
    );
    logger.apiRequest(
      "POST",
      "/api/inventory/masuk",
      201,
      Date.now() - startTime,
      {
        userId: user.id,
        barangId,
        gudangId,
        jumlah: parsedJumlah,
        masukId: masukRecord.id,
      },
    );

    // System Log
    logActivitySafe({
      action: "CREATE",
      subject: "Inventory In",
      userId: user.id,
      details: {
        id: masukRecord.id,
        barangId,
        gudangId,
        quantity: parsedJumlah,
      },
    });

    // Broadcast inventory update
    const { socketEmitter } = await import("@/lib/websocket/emitter");
    socketEmitter.inventoryUpdate({
      type: "masuk",
      userId: user.id,
      barangId,
      gudangId,
      jumlah: parsedJumlah,
      totalStok: finalStock,
    });

    // Publish domain event
    const { InventoryEventDispatcher } = await import("@/modules/events");
    await InventoryEventDispatcher.onStockIn({
      barangId,
      barangName: (masukRecord as Record<string, unknown>)?.barang
        ? ((
            (masukRecord as Record<string, unknown>).barang as Record<
              string,
              unknown
            >
          )?.nama as string)
        : undefined,
      gudangId,
      jumlah: parsedJumlah,
      totalStok: finalStock,
      userId: user.id,
    }).catch((err) =>
      logger.error(
        "Failed to publish INVENTORY_STOCK_IN event",
        err instanceof Error ? err : undefined,
      ),
    );

    return apiSuccess(
      {
        message: "Barang masuk berhasil dicatat",
        masukId: masukRecord.id,
        data: masukRecord,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error creating barang masuk", err, {
      path: "/api/inventory/masuk",
      method: "POST",
    });

    if (err.message === "Barang tidak ditemukan") {
      return ApiErrors.notFound("Barang");
    }
    if (err.message === "Gudang tidak ditemukan atau tidak aktif") {
      return ApiErrors.badRequest("Gudang tidak ditemukan atau tidak aktif");
    }

    return ApiErrors.internalError("Gagal mencatat barang masuk");
  }
});
