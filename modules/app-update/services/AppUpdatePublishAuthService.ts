import { timingSafeEqual } from "crypto";

import { logger } from "@/lib/logger";

/**
 * Bearer token authentication untuk endpoint publish OTA dari Jenkins/CI.
 *
 * Setup ENV:
 *   APP_UPDATE_PUBLISH_TOKEN  - shared secret antara Jenkins dan server
 *
 * Token dibandingkan dengan timingSafeEqual untuk cegah timing attack.
 * Endpoint yang protected: POST /api/admin/app-update (publish bundle baru).
 *
 * UI admin tetap pakai session-based auth lewat createHandler. Bearer token
 * khusus untuk automation pipeline.
 */

const HEADER_PREFIX = "Bearer ";

export interface AppUpdatePublishAuthResult {
  ok: boolean;
  reason?: string;
}

export function isAppUpdatePublishTokenConfigured(): boolean {
  return Boolean(process.env.APP_UPDATE_PUBLISH_TOKEN?.trim());
}

export function verifyAppUpdatePublishToken(
  authorizationHeader: string | null,
): AppUpdatePublishAuthResult {
  const expected = process.env.APP_UPDATE_PUBLISH_TOKEN?.trim();
  if (!expected) {
    return { ok: false, reason: "APP_UPDATE_PUBLISH_TOKEN not configured" };
  }
  if (!authorizationHeader || !authorizationHeader.startsWith(HEADER_PREFIX)) {
    return { ok: false, reason: "Missing Bearer token" };
  }
  const provided = authorizationHeader.slice(HEADER_PREFIX.length).trim();
  if (!provided) {
    return { ok: false, reason: "Empty Bearer token" };
  }

  try {
    const expectedBuffer = Buffer.from(expected, "utf8");
    const providedBuffer = Buffer.from(provided, "utf8");
    if (expectedBuffer.length !== providedBuffer.length) {
      return { ok: false, reason: "Token mismatch" };
    }
    if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
      return { ok: false, reason: "Token mismatch" };
    }
    return { ok: true };
  } catch (error) {
    logger.error("[AppUpdatePublishAuth] verify failed", error);
    return { ok: false, reason: "Token verification error" };
  }
}
