import { NextRequest, NextResponse } from "next/server";

import { ApiErrors } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  AppReleaseMutationService,
  AppReleaseQueryService,
  AppReleaseRepository,
  appReleaseUpdateSchema,
  AppReleaseNotFoundError,
} from "@/modules/app-version";
import type { AppRelease } from "@/modules/app-version";

const repository = new AppReleaseRepository();
const queryService = new AppReleaseQueryService(repository);
const mutationService = new AppReleaseMutationService(repository);

const PERMISSION = "app-release:manage";

/** Konversi BigInt apkSizeBytes ke Number agar JSON-serializable */
function serializeRelease(r: AppRelease) {
  return {
    ...r,
    apkSizeBytes: r.apkSizeBytes !== null ? Number(r.apkSizeBytes) : null,
  };
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/app-releases/[id]
 * Ambil detail satu app release berdasarkan ID
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  if (!(await hasPermission(PERMISSION))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  try {
    const { id } = await context.params;
    const release = await queryService.getById(id);
    return NextResponse.json(serializeRelease(release));
  } catch (error) {
    if (error instanceof AppReleaseNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    return ApiErrors.internalError("Gagal ambil detail release");
  }
}

/**
 * PATCH /api/admin/app-releases/[id]
 * Update data app release
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!(await hasPermission(PERMISSION))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = appReleaseUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest("Input tidak valid", {
        errors: parsed.error.format(),
      });
    }

    const updateInput = {
      ...parsed.data,
      apkSizeBytes:
        parsed.data.apkSizeBytes != null
          ? BigInt(parsed.data.apkSizeBytes)
          : undefined,
    };
    const updated = await mutationService.update(id, updateInput);
    return NextResponse.json(serializeRelease(updated));
  } catch (error) {
    if (error instanceof AppReleaseNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    return ApiErrors.internalError("Gagal update release");
  }
}

/**
 * DELETE /api/admin/app-releases/[id]
 * Nonaktifkan app release (soft delete via deactivate)
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  if (!(await hasPermission(PERMISSION))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  try {
    const { id } = await context.params;
    await mutationService.deactivate(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AppReleaseNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    return ApiErrors.internalError("Gagal hapus release");
  }
}
