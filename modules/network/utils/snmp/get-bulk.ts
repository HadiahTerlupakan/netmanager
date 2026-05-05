import { executeBulkRequest } from "./get-bulk.executor";

/** Read a subtree with SNMP GETBULK. */
export async function snmpGetBulkSimple(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 30_000,
  maxResults?: number,
  expectedCount?: number,
): Promise<Record<string, string>> {
  return snmpGetBulk({
    ipAddress,
    port,
    community,
    version,
    oid,
    timeout,
    maxResults,
    expectedCount,
  });
}

/** Execute a low-level GETBULK query and aggregate subtree values. */
export async function snmpGetBulk(params: {
  ipAddress: string;
  port: number;
  community: string;
  version: string;
  oid: string;
  timeout?: number;
  maxResults?: number;
  expectedCount?: number;
}): Promise<Record<string, string>> {
  return executeBulkRequest(params);
}
