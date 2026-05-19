import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAuth } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  announcementService,
  createAnnouncementSchema,
} from "@/modules/notification";

/** Ambil daftar announcement yang tampil di admin/portal user. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const portal = searchParams.get("portal");

  // Caller tanpa parameter `portal` (mis. halaman admin index) wajib
  // punya `announcement:read`. Caller dengan portal customer/employee/
  // admin diasumsikan layout-level guard sudah memvalidasi role.
  if (!portal && !(await hasPermission("announcement:read"))) {
    return ApiErrors.forbidden();
  }

  try {
    const announcements = await announcementService.getAnnouncements({
      target: searchParams.get("target") ?? undefined,
      activeOnly: searchParams.get("active") === "true",
      portal,
    });

    return NextResponse.json(announcements);
  } catch (error) {
    logger.error("Failed to list announcements", error as Error, {
      path: "/api/announcements",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat daftar pengumuman");
  }
}

/** Buat announcement baru. Wajib `announcement:create`. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;

  if (!(await hasPermission("announcement:create"))) {
    return ApiErrors.forbidden();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiErrors.badRequest("Body request tidak valid");
  }

  const parsed = createAnnouncementSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  try {
    const announcement = await announcementService.createAnnouncement(
      parsed.data,
      session.user.id,
    );
    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    logger.error("Failed to create announcement", error as Error, {
      path: "/api/announcements",
      method: "POST",
      userId: session.user.id,
    });
    return ApiErrors.internalError("Gagal membuat pengumuman");
  }
}

function zodErrorResponse(error: ZodError) {
  const flat = error.flatten((issue) => issue.message);
  const details: Record<string, string[]> = {};

  for (const [path, messages] of Object.entries(flat.fieldErrors)) {
    const list = messages as string[] | undefined;
    if (list && list.length > 0) details[path] = list;
  }
  if (flat.formErrors.length > 0) details["_form"] = flat.formErrors;

  const firstMessage =
    Object.values(details).flat()[0] ?? "Payload pengumuman tidak valid";

  return ApiErrors.badRequest(firstMessage, details);
}
