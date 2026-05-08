import { NextRequest } from "next/server";
import { hasPermission, getCurrentUser } from "@/lib/rbac";
import {
  validateMitraSiteAccess,
  validateNewSiteId,
  unauthorizedResponse,
  accessDeniedResponse,
  notFoundResponse,
  badRequestResponse,
  successResponse,
  mitraService,
} from "./route.helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (
    !user ||
    !user.id ||
    !(await hasPermission("mitra:read", user, { silent: true }))
  ) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  const access = await validateMitraSiteAccess(id, {
    id: user.id,
    name: user.name,
  });
  if (!access.allowed) {
    return accessDeniedResponse(access.error);
  }

  const result = await mitraService.getMitraById(id);

  if (!result.success) {
    return notFoundResponse(result.error);
  }

  return successResponse(result.data);
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
    return unauthorizedResponse();
  }

  const { id } = await params;

  const access = await validateMitraSiteAccess(id, {
    id: user.id,
    name: user.name,
  });
  if (!access.allowed) {
    return accessDeniedResponse(access.error);
  }

  try {
    const body = await request.json();

    const siteValidation = await validateNewSiteId(user, body.siteId);
    if (!siteValidation.valid) {
      return accessDeniedResponse(siteValidation.error);
    }

    const result = await mitraService.updateMitra(id, body, user.id!);

    if (!result.success) {
      return badRequestResponse(result.error);
    }

    return successResponse();
  } catch {
    return badRequestResponse("Invalid request body");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (
    !user ||
    !user.id ||
    !(await hasPermission("mitra:delete", user, { silent: true }))
  ) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  const access = await validateMitraSiteAccess(id, {
    id: user.id,
    name: user.name,
  });
  if (!access.allowed) {
    return accessDeniedResponse(access.error);
  }

  const result = await mitraService.deleteMitra(id, user.id!);

  if (!result.success) {
    return badRequestResponse(result.error);
  }

  return successResponse();
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
    return unauthorizedResponse();
  }

  const { id } = await params;

  const access = await validateMitraSiteAccess(id, {
    id: user.id,
    name: user.name,
  });
  if (!access.allowed) {
    return accessDeniedResponse(access.error);
  }

  try {
    const body = await request.json();

    const siteValidation = await validateNewSiteId(user, body.siteId);
    if (!siteValidation.valid) {
      return accessDeniedResponse(siteValidation.error);
    }

    const result = await mitraService.updateMitra(id, body, user.id!);

    if (!result.success) {
      return badRequestResponse(result.error);
    }

    const { socketEmitter } = await import("@/lib/websocket/emitter");
    socketEmitter.profileRefresh(id);

    return successResponse();
  } catch {
    return badRequestResponse("Invalid request body");
  }
}
