import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getUserPermissions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parsePaginationParams } from "@/lib/utils/pagination";
import { hasPermission } from "@/lib/rbac";
import { getInventoryOpnameService } from "@/modules/inventory";

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("opname:read"))) {
    return ApiErrors.forbidden();
  }

  const { searchParams } = req.nextUrl;
  const barangId = searchParams.get("barangId") || undefined;
  const gudangId = searchParams.get("gudangId") || undefined;
  const { page, limit } = parsePaginationParams(searchParams, {
    page: 1,
    limit: 20,
  });

  try {
    const opnameService = getInventoryOpnameService();
    const result = await opnameService.listOpname({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: await getUserPermissions(user.id),
        siteId: user.siteId,
      },
      barangId,
      gudangId,
      page,
      limit,
    });

    logger.apiRequest(
      "GET",
      "/api/inventory/opname",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        count: result.opnameList.length,
        page,
        limit,
        total: result.pagination.total,
        barangId,
        gudangId,
      },
    );

    return apiSuccess(result);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching stock opname", err, {
      path: "/api/inventory/opname",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat data stock opname");
  }
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("opname:create"))) {
    return ApiErrors.forbidden();
  }

  const body = await req.json();
  const {
    barangId,
    gudangId,
    stokFisik,
    keterangan,
    kondisiBaik = 0,
    kondisiRusak = 0,
    kondisiExpire = 0,
    lokasiPenyimpanan,
    nomorRak,
    nomorBox,
    pic: _pic,
    suhuPenyimpanan,
    kelembaban,
    tanggalExpire,
    nomorBatch,
    catatanDetail,
    alasanSelisih,
  } = body;

  if (!barangId || !gudangId || stokFisik === undefined || stokFisik < 0) {
    return ApiErrors.badRequest(
      "Barang, gudang, dan stok fisik harus diisi dengan benar",
    );
  }

  const totalKondisi = kondisiBaik + kondisiRusak + kondisiExpire;
  if (totalKondisi > stokFisik) {
    return ApiErrors.badRequest(
      "Total jumlah kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik",
    );
  }

  try {
    const opnameService = getInventoryOpnameService();
    const result = await opnameService.createOpname({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: await getUserPermissions(user.id),
        siteId: user.siteId,
      },
      barangId,
      gudangId,
      stokFisik,
      keterangan,
      kondisiBaik,
      kondisiRusak,
      kondisiExpire,
      lokasiPenyimpanan,
      nomorRak,
      nomorBox,
      suhuPenyimpanan,
      kelembaban,
      tanggalExpire,
      nomorBatch,
      catatanDetail,
      alasanSelisih,
    });

    logger.apiRequest(
      "POST",
      "/api/inventory/opname",
      201,
      Date.now() - startTime,
      {
        userId: user.id,
        barangId,
        gudangId,
        stokFisik,
        stokSistem: result.previousStock,
        selisih: result.selisih,
        opnameId: result.opnameRecord.id,
      },
    );

    return apiSuccess(
      {
        message: "Stock opname berhasil dicatat",
        opname: {
          ...result.opnameRecord,
          previousStock: result.previousStock,
          newStock: result.newStock,
          selisih: result.selisih,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error creating stock opname", err, {
      path: "/api/inventory/opname",
      method: "POST",
    });

    if (err.message === "Barang tidak ditemukan") {
      return ApiErrors.notFound("Barang tidak ditemukan");
    }
    if (err.message === "Gudang tidak ditemukan atau tidak aktif") {
      return ApiErrors.badRequest(err.message);
    }
    if (
      err.message.includes("Akses") ||
      err.message.includes("akses") ||
      err.message.includes("Gudang ini")
    ) {
      return ApiErrors.forbidden(err.message);
    }

    return ApiErrors.internalError("Gagal mencatat stock opname");
  }
});
