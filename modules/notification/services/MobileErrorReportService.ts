import { NextRequest } from "next/server";

import { apiError, ErrorCodes } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { authenticateMobileRequest } from "@/lib/mobile-api-auth";
import { validateRequired } from "@/lib/validation-utils";
import type { IMobileErrorReportRepository } from "../domain/ports/IMobileErrorReportRepository";
import { MobileErrorReportRepository } from "../repositories/MobileErrorReportRepository";

const DEFAULT_MESSAGE_MAX = 1000;
const DEFAULT_KIND_MAX = 120;
const DEFAULT_SOURCE_MAX = 120;
const DEFAULT_SEVERITY = "error";
const DEFAULT_STACK_MAX = 8000;
const MAX_BREADCRUMBS = 20;
const mobileErrorReportRepository = new MobileErrorReportRepository();

type MobileErrorReportPayload = {
  message?: unknown;
  kind?: unknown;
  source?: unknown;
  severity?: unknown;
  route?: unknown;
  screen?: unknown;
  appVersion?: unknown;
  platform?: unknown;
  occurredAt?: unknown;
  stack?: unknown;
  breadcrumbs?: unknown;
  context?: unknown;
};

type MobileAuthContext = {
  userId?: string;
  tenantId?: string | null;
  role?: string;
  email?: string;
};

type MobileErrorReportActor = {
  userId: string | null;
  actorType: string | null;
  actorId: string | null;
  tenantId: string | null;
};

const ACTOR_TYPE_BY_ROLE: Record<string, string> = {
  MITRA: "mitra",
  CUSTOMER: "customer",
};

/**
 * Map auth payload menjadi actor SystemLog.
 *
 * Mitra & pelanggan tidak ada di tabel `User` (DB utama), jadi `userId`
 * diset null dan aktor direpresentasikan via `actorType` + `actorId`
 * untuk menghindari FK violation `SystemLog_userId_fkey`. User biasa
 * tetap ditulis via `userId` dengan `actorType: "user"`.
 */
function resolveReportActor(
  authPayload: MobileAuthContext | null,
): MobileErrorReportActor {
  if (!authPayload?.userId) {
    return { userId: null, actorType: null, actorId: null, tenantId: null };
  }

  const actorType = ACTOR_TYPE_BY_ROLE[authPayload.role ?? ""] ?? "user";
  if (actorType === "user") {
    return {
      userId: authPayload.userId,
      actorType,
      actorId: authPayload.userId,
      tenantId: authPayload.tenantId ?? null,
    };
  }

  return {
    userId: null,
    actorType,
    actorId: authPayload.userId,
    tenantId: authPayload.tenantId ?? null,
  };
}

/** Memvalidasi dan menyimpan laporan error mobile ke system log. */
export async function submitMobileErrorReport(
  request: NextRequest,
  repository: IMobileErrorReportRepository = mobileErrorReportRepository,
) {
  const body = (await request.json()) as MobileErrorReportPayload;
  const report = buildValidatedReport(body);
  const authPayload = await resolveOptionalAuthPayload(request);
  const reportDetails = buildReportDetails(report, authPayload);

  logger.error("Mobile error report received", undefined, reportDetails);
  const actor = resolveReportActor(authPayload);
  await repository.createSystemLog({
    action: "MOBILE_ERROR_REPORT",
    subject: report.kind,
    details: safeStringify(reportDetails),
    userId: actor.userId,
    actorType: actor.actorType,
    actorId: actor.actorId,
    tenantId: actor.tenantId,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });
}

function buildValidatedReport(body: MobileErrorReportPayload) {
  const requiredFields = buildRequiredReportFields(body);

  return {
    ...requiredFields,
    severity: sanitizeString(body.severity, 50) || DEFAULT_SEVERITY,
    route: sanitizeString(body.route, 255),
    screen: sanitizeString(body.screen, 255),
    appVersion: sanitizeString(body.appVersion, 120),
    platform: sanitizeString(body.platform, 50),
    occurredAt: sanitizeString(body.occurredAt, 100),
    stack: sanitizeString(body.stack, DEFAULT_STACK_MAX),
    breadcrumbs: normalizeBreadcrumbs(body.breadcrumbs),
    context: normalizeErrorContext(body.context),
  };
}

function buildRequiredReportFields(body: MobileErrorReportPayload) {
  return {
    message: requireValue(
      sanitizeString(body.message, DEFAULT_MESSAGE_MAX),
      "message",
    ),
    kind: requireValue(sanitizeString(body.kind, DEFAULT_KIND_MAX), "kind"),
    source: requireValue(
      sanitizeString(body.source, DEFAULT_SOURCE_MAX),
      "source",
    ),
  };
}

function normalizeBreadcrumbs(value: unknown) {
  return Array.isArray(value) ? value.slice(-MAX_BREADCRUMBS) : [];
}

function normalizeErrorContext(value: unknown) {
  return typeof value === "object" && value !== null ? value : {};
}

async function resolveOptionalAuthPayload(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const authResult = await authenticateMobileRequest(request);
  if ("payload" in authResult) {
    return authResult.payload as MobileAuthContext;
  }

  logger.warn(
    "Mobile error report received with invalid auth, falling back to anonymous report",
    {
      status: authResult.response.status,
    },
  );
  return null;
}

function buildReportDetails(
  report: ReturnType<typeof buildValidatedReport>,
  authPayload: MobileAuthContext | null,
) {
  return {
    ...report,
    authContext: authPayload
      ? {
          tenant: authPayload.tenantId ?? null,
          role: authPayload.role ?? null,
          email: authPayload.email ?? null,
        }
      : null,
  };
}

function requireValue(value: string | null, fieldName: string) {
  const validation = validateRequired(value, fieldName);
  if (validation.valid) {
    return value as string;
  }

  throw apiError(
    validation.error ?? "Payload tidak valid",
    ErrorCodes.VALIDATION_ERROR,
    { status: 400 },
  );
}

function sanitizeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  return trimmedValue.slice(0, maxLength);
}

function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || null;
}

function safeStringify(payload: Record<string, unknown>) {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({
      message: "Failed to serialize mobile error report payload",
    });
  }
}
