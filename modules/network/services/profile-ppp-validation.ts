import type { Session } from "next-auth";

import {
  profilePPPSchema,
  type ProfilePPPSchema,
} from "@/lib/validations/profileppp";
import { checkSiteRestriction } from "@/modules/roles";
import {
  getOptionalIdentifier,
  getOptionalNumber,
  getProfilePoolMode,
  getProfileStatus,
  getSanitizedOptionalText,
} from "./profile-ppp-validation.helpers";

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
    name: getSanitizedOptionalText(body.name),
    localAddress: getSanitizedOptionalText(body.localAddress),
    remoteAddress: getSanitizedOptionalText(body.remoteAddress),
    ipRange: getSanitizedOptionalText(body.ipRange),
    dnsServer: getSanitizedOptionalText(body.dnsServer),
    sessionTimeout: getOptionalNumber(body.sessionTimeout),
    idleTimeout: getOptionalNumber(body.idleTimeout),
    poolMode: getProfilePoolMode(body.poolMode),
    mikroTikRouterId: getOptionalIdentifier(body.mikroTikRouterId),
    bandwidthId: getOptionalIdentifier(body.bandwidthId),
    description: getSanitizedOptionalText(body.description),
    status: getProfileStatus(body.status),
    siteId: getOptionalIdentifier(body.siteId),
  };
}
