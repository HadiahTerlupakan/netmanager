import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAuth } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  announcementService,
  updateAnnouncementSchema,
} from "@/modules/notification";

/** Update one announcement by id. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;

  if (!(await hasPermission("announcement:update"))) {
    return ApiErrors.forbidden();
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiErrors.badRequest("Body request tidak valid");
  }

  const parsed = updateAnnouncementSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  try {
    const announcement = await announcementService.updateAnnouncement(
      id,
      parsed.data,
    );
    return NextResponse.json(announcement);
  } catch (error) {
    logger.error("Failed to update announcement", error as Error, {
      path: "/api/announcements/[id]",
      method: "PUT",
      announcementId: id,
      userId: session.user.id,
    });
    return ApiErrors.internalError("Gagal memperbarui pengumuman");
  }
}

/** Delete one announcement by id. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;

  if (!(await hasPermission("announcement:delete"))) {
    return ApiErrors.forbidden();
  }

  const { id } = await params;

  try {
    const result = await announcementService.deleteAnnouncement(id);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("Failed to delete announcement", error as Error, {
      path: "/api/announcements/[id]",
      method: "DELETE",
      announcementId: id,
      userId: session.user.id,
    });
    return ApiErrors.internalError("Gagal menghapus pengumuman");
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
