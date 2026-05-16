import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { ApiErrors } from "@/lib/api";
import { authConfig } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  appReleaseCreateSchema,
  getAppReleaseServices,
} from "@/modules/app-version";
import type { AppRelease, AppReleasePlatform } from "@/modules/app-version";

const PERMISSION = "app-release:manage";

/** Konversi BigInt apkSizeBytes ke Number agar JSON-serializable */
function serializeRelease(r: AppRelease) {
  return {
    ...r,
    apkSizeBytes: r.apkSizeBytes !== null ? Number(r.apkSizeBytes) : null,
  };
}

/**
 * GET /api/admin/app-releases
 * List semua app release dengan pagination dan filter platform
 */
export async function GET(request: NextRequest) {
  if (!(await hasPermission(PERMISSION))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  try {
    const url = new URL(request.url);
    const platform = url.searchParams.get(
      "platform",
    ) as AppReleasePlatform | null;
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") ?? "20")),
    );

    const { queryService } = await getAppReleaseServices();
    const { items, total } = await queryService.list({
      ...(platform ? { platform } : {}),
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      data: items.map(serializeRelease),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return ApiErrors.internalError("Gagal ambil data release");
  }
}

/**
 * POST /api/admin/app-releases
 * Buat app release baru
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return ApiErrors.unauthorized();
  }

  if (!(await hasPermission(PERMISSION, session.user))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  try {
    const body = await request.json();
    const parsed = appReleaseCreateSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest("Input tidak valid", {
        issues: parsed.error.issues,
      });
    }

    const createInput = {
      ...parsed.data,
      apkSizeBytes:
        parsed.data.apkSizeBytes != null
          ? BigInt(parsed.data.apkSizeBytes)
          : undefined,
    };
    const { mutationService } = await getAppReleaseServices();
    const release = await mutationService.create(createInput, session.user.id);

    return NextResponse.json(serializeRelease(release), { status: 201 });
  } catch {
    return ApiErrors.internalError("Gagal buat release");
  }
}
