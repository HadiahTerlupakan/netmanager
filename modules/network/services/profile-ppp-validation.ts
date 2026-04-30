import type { Session } from "next-auth";

import { sanitizeInput } from "@/lib/utils/sanitize";
import {
  profilePPPSchema,
  type ProfilePPPSchema,
} from "@/lib/validations/profileppp";
import { checkSiteRestriction } from "@/modules/roles";

export function validateProfilePPPBody(body: Record<string, unknown>) {
  return profilePPPSchema.safeParse(sanitizeProfilePPPBody(body));
}

export function applyRestrictedProfilePPPSite(
  session: Session | null,
  data: ProfilePPPSchema,
): ProfilePPPSchema {
  const { isRestricted, primarySiteId } = checkSiteRestriction(
    session,
    "profileppp",
  );

  if (!isRestricted || !primarySiteId) {
    return data;
  }

  return { ...data, siteId: primarySiteId };
}

function sanitizeProfilePPPBody(body: Record<string, unknown>) {
  return {
    name: typeof body.name === "string" ? sanitizeInput(body.name) : undefined,
    localAddress:
      typeof body.localAddress === "string"
        ? sanitizeInput(body.localAddress)
        : undefined,
    remoteAddress:
      typeof body.remoteAddress === "string"
        ? sanitizeInput(body.remoteAddress)
        : undefined,
    ipRange:
      typeof body.ipRange === "string" && body.ipRange.trim()
        ? sanitizeInput(body.ipRange)
        : undefined,
    dnsServer:
      typeof body.dnsServer === "string" && body.dnsServer.trim()
        ? sanitizeInput(body.dnsServer)
        : undefined,
    sessionTimeout: getOptionalNumber(body.sessionTimeout),
    idleTimeout: getOptionalNumber(body.idleTimeout),
    poolMode:
      typeof body.poolMode === "string" && body.poolMode
        ? body.poolMode
        : "MIKROTIK",
    mikroTikRouterId:
      typeof body.mikroTikRouterId === "string" && body.mikroTikRouterId.trim()
        ? body.mikroTikRouterId
        : undefined,
    bandwidthId:
      typeof body.bandwidthId === "string" && body.bandwidthId.trim()
        ? body.bandwidthId
        : undefined,
    description:
      typeof body.description === "string" && body.description.trim()
        ? sanitizeInput(body.description)
        : undefined,
    status:
      typeof body.status === "string" && body.status ? body.status : "AKTIF",
    siteId:
      typeof body.siteId === "string" && body.siteId.trim()
        ? body.siteId
        : undefined,
  };
}

function getOptionalNumber(value: unknown) {
  return value !== undefined && value !== null && value !== ""
    ? Number(value)
    : undefined;
}
