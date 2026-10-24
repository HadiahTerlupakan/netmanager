import { logger } from "@/lib/logger";
import type { RouterOSAPI } from "node-routeros-v2";
import { delay } from "./mikrotik-provisioning.connection";
import { restoreRows, type RouterRow } from "./mikrotik-provisioning.restore";

const PROXY_PORT = "8181";
const EXPIRED_NETWORK = "10.127.0.0/18";
const PROXY_RULE_COMMENT = `added by netmanager - ${EXPIRED_NETWORK}`;

function extractDomain(isolirUrl?: string | null) {
  return isolirUrl?.replace(/^https?:\/\//, "").split("/")[0] || null;
}

async function enableWebProxy(connection: RouterOSAPI, logs: string[]) {
  await connection.write("/ip/proxy/set", [
    "=enabled=yes",
    `=port=${PROXY_PORT}`,
  ]);
  await delay(200);
  logs.push(`Configured Web Proxy: Enabled on port ${PROXY_PORT}`);
}

function getProxyRuleArgs(domain: string) {
  return [
    `=src-address=${EXPIRED_NETWORK}`,
    "=action=redirect",
    `=action-data=${domain}`,
  ];
}

async function readProxyRules(connection: RouterOSAPI) {
  return (await connection.write("/ip/proxy/access/print", [
    `?comment=${PROXY_RULE_COMMENT}`,
  ])) as RouterRow[];
}

async function addProxyRule(
  connection: RouterOSAPI,
  domain: string,
  logs: string[],
) {
  await connection.write("/ip/proxy/access/add", [
    ...getProxyRuleArgs(domain),
    `=comment=${PROXY_RULE_COMMENT}`,
  ]);
  await delay(200);
  logs.push(
    `Added Web Proxy Access Rule: Redirect ${EXPIRED_NETWORK} to ${domain}`,
  );
}

function resolveProxyDomain(isolirUrl?: string | null) {
  if (!isolirUrl) {
    return null;
  }

  return extractDomain(isolirUrl);
}

function getWebProxyMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function logWebProxyError(logs: string[], action: string, error: unknown) {
  const message = getWebProxyMessage(error);
  logger.error(`[Provisioning] Web Proxy Error: ${message}`);
  logs.push(`Failed to ${action}: ${message}`);
}

async function removeProxyRules(connection: RouterOSAPI, logs: string[]) {
  const proxyRules = await readProxyRules(connection);

  for (const rule of proxyRules) {
    await connection.write("/ip/proxy/access/remove", [`=.id=${rule[".id"]}`]);
    await delay(100);
    logs.push("Removed Web Proxy Access Rule");
  }
}

export async function provisionWebProxy(params: {
  connection: RouterOSAPI;
  isolirUrl?: string | null;
  logs: string[];
}) {
  const domain = resolveProxyDomain(params.isolirUrl);
  if (!domain) {
    return;
  }

  try {
    await enableWebProxy(params.connection, params.logs);
    const existing = await readProxyRules(params.connection);
    if (existing.length === 0) {
      await addProxyRule(params.connection, domain, params.logs);
      return;
    }
    // Catches an ISOLIR_URL changed after the router was provisioned.
    await restoreRows({
      connection: params.connection,
      path: "/ip/proxy/access",
      rows: existing,
      args: getProxyRuleArgs(domain),
      logs: params.logs,
      label: "Web Proxy Access Rule",
    });
  } catch (error: unknown) {
    logWebProxyError(params.logs, "configure Web Proxy", error);
  }
}

export async function removeWebProxy(params: {
  connection: RouterOSAPI;
  isolirUrl?: string | null;
  logs: string[];
}) {
  await removeProxyRules(params.connection, params.logs);
  if (!params.isolirUrl) {
    return;
  }

  try {
    await params.connection.write("/ip/proxy/set", ["=enabled=no"]);
    params.logs.push("Disabled Web Proxy");
  } catch (error: unknown) {
    logWebProxyError(params.logs, "disable Web Proxy", error);
  }
}
