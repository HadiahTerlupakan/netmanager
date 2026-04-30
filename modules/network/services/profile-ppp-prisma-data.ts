import { randomUUID } from "crypto";
import type { ProfilePPPSchema } from "@/lib/validations/profileppp";

export function buildCreateProfilePPPData(data: ProfilePPPSchema) {
  return {
    id: randomUUID(),
    name: data.name,
    localAddress: data.localAddress,
    remoteAddress: data.remoteAddress,
    dnsServer: data.dnsServer || null,
    sessionTimeout: data.sessionTimeout || null,
    idleTimeout: data.idleTimeout || null,
    poolMode: data.poolMode,
    description: data.description || null,
    status: data.status,
    siteId: data.siteId || null,
    mikroTikRouterId: data.mikroTikRouterId || null,
    updatedAt: new Date(),
  };
}

export function buildUpdateProfilePPPData(data: ProfilePPPSchema) {
  return {
    name: data.name,
    localAddress: data.localAddress,
    remoteAddress: data.remoteAddress,
    dnsServer: data.dnsServer !== undefined ? data.dnsServer : null,
    sessionTimeout:
      data.sessionTimeout !== undefined ? data.sessionTimeout : null,
    idleTimeout: data.idleTimeout !== undefined ? data.idleTimeout : null,
    poolMode: data.poolMode,
    description: data.description !== undefined ? data.description : null,
    status: data.status,
    mikroTikRouterId:
      data.mikroTikRouterId !== undefined ? data.mikroTikRouterId : null,
    updatedAt: new Date(),
  };
}
