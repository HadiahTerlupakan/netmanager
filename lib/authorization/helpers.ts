import { NextRequest, NextResponse } from "next/server";
import {
  authorize,
  type AuthorizationResult,
  type AuthorizedSession,
} from "./evaluator";

/**
 * Helper Functions & Type Guards untuk Authorization
 */

export async function authorizeBasic(
  request: NextRequest,
): Promise<AuthorizationResult> {
  return authorize(request, {});
}

export async function authorizeWithPermission(
  request: NextRequest,
  permission: string,
): Promise<AuthorizationResult> {
  return authorize(request, { permissions: [permission] });
}

export async function authorizeWithAnyPermission(
  request: NextRequest,
  permissions: string[],
): Promise<AuthorizationResult> {
  return authorize(request, { permissions, requireAll: false });
}

export async function authorizeWithAllPermissions(
  request: NextRequest,
  permissions: string[],
): Promise<AuthorizationResult> {
  return authorize(request, { permissions, requireAll: true });
}

export function hasPermissionInSession(
  session: AuthorizedSession,
  permission: string,
): boolean {
  return session.permissions.includes(permission);
}

export function hasAnyPermissionInSession(
  session: AuthorizedSession,
  permissions: string[],
): boolean {
  return permissions.some((p) => session.permissions.includes(p));
}

export function isAuthError(
  result: AuthorizationResult,
): result is { error: NextResponse } {
  return "error" in result;
}

export function isAuthorized(
  result: AuthorizationResult,
): result is { session: AuthorizedSession } {
  return "session" in result;
}
