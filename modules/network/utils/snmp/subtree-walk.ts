import { executeSubtreeWalk } from "./subtree-walk.executor";
import type { SnmpWalkResult } from "./types";

/** Walk an SNMP subtree using subtree batching. */
export async function snmpWalkWithSubtree(params: {
  ipAddress: string;
  port: number;
  community: string;
  version: string;
  oid: string;
  timeout: number;
  maxResults?: number;
  expectedCount?: number;
}): Promise<SnmpWalkResult[]> {
  return executeSubtreeWalk(params);
}
