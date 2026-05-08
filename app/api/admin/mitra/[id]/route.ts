import { NextRequest, NextResponse } from "next/server";
import { hasPermission, getCurrentUser } from "@/lib/rbac";
import { getMitraService } from "@/modules/mitra";
import { checkSiteRestriction } from "@/modules/roles";

const mitraService = getMitraService();

async function validateMitraSiteAccess(
  mitraId: string,
  user: { id: string; name?: string | null },
): Promise<{ allowed: boolean; error?: string }> {
  const { isRestricted, siteIds } = checkSiteRestriction(
    { user } as never,
    "mitra",
  );
  if (!isRestricted) return { allowed: true };

  const mitra = await mitraService.getMitraById(mitraId);
  if (!mitra.success) return { allowed: false, error: "Mitra tidak ditemukan" };

  if (!mitra.data.siteId || !siteIds.includes(mitra.data.siteId)) {
    return {
      allowed: false,
      error: "Anda tidak dapat mengakses mitra di luar scope Anda",
    };
  }

  return { allowed: true };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (
    !user ||
    !user.id ||
    !(await hasPermission("mitra:read", user, { silent: true }))
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 },
    );
  }

  const { id } = await params;

  const access = await validateMitraSiteAccess(id, {
    id: user.id,
    name: user.name,
  });
  if (!access.allowed) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: 403 },
    );
  }

  const result = await mitraService.getMitraById(id);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (
    !user ||
    !user.id ||
    !(await hasPermission("mitra:update", user, { silent: true }))
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 },
    );
  }

  const { id } = await params;

  const access = await validateMitraSiteAccess(id, {
    id: user.id,
    name: user.name,
  });
  if (!access.allowed) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();

    // Validate new siteId if being changed
    const { isRestricted, siteIds } = checkSiteRestriction(
      { user } as never,
      "mitra",
    );
    if (isRestricted && body.siteId && !siteIds.includes(body.siteId)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Anda tidak dapat memindahkan mitra ke site di luar scope Anda",
        },
        { status: 403 },
      );
    }

    const result = await mitraService.updateMitra(id, body, user.id!);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (
    !user ||
    !user.id ||
    !(await hasPermission("mitra:delete", user, { silent: true }))
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 },
    );
  }

  const { id } = await params;

  const access = await validateMitraSiteAccess(id, {
    id: user.id,
    name: user.name,
  });
  if (!access.allowed) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: 403 },
    );
  }

  const result = await mitraService.deleteMitra(id, user.id!);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (
    !user ||
    !user.id ||
    !(await hasPermission("mitra:update", user, { silent: true }))
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 },
    );
  }

  const { id } = await params;

  const access = await validateMitraSiteAccess(id, {
    id: user.id,
    name: user.name,
  });
  if (!access.allowed) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();

    // Validate new siteId if being changed
    const { isRestricted, siteIds } = checkSiteRestriction(
      { user } as never,
      "mitra",
    );
    if (isRestricted && body.siteId && !siteIds.includes(body.siteId)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Anda tidak dapat memindahkan mitra ke site di luar scope Anda",
        },
        { status: 403 },
      );
    }

    const result = await mitraService.updateMitra(id, body, user.id!);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    // Push real-time profile refresh to mobile app via Socket.IO
    // This replaces the need for polling on the mobile side
    const { socketEmitter } = await import("@/lib/websocket/emitter");
    socketEmitter.profileRefresh(id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 },
    );
  }
}
