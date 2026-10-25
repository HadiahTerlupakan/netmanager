import { logger } from "@/lib/logger";
import type { RouterOSAPI } from "node-routeros-v2";
import { delay } from "./mikrotik-provisioning.connection";
import { restoreRows, type RouterRow } from "./mikrotik-provisioning.restore";
import type { IsolirProvisioning } from "../isolir/isolir-provisioning";

const PROXY_PORT = "8181";
const EXPIRED_NETWORK = "10.127.0.0/18";
const PROXY_RULE_COMMENT = `added by netmanager - ${EXPIRED_NETWORK}`;

async function enableWebProxy(connection: RouterOSAPI, logs: string[]) {
  await connection.write("/ip/proxy/set", [
    "=enabled=yes",
    `=port=${PROXY_PORT}`,
  ]);
  await delay(200);
  logs.push(`Configured Web Proxy: Enabled on port ${PROXY_PORT}`);
}

// deny membuat router menyajikan webproxy/error.html, yaitu halaman isolir
// yang ditulis billing.
function getProxyRuleArgs(isolir: IsolirProvisioning) {
  if (isolir.mode === "ROUTER_PAGE") {
    return [`=src-address=${EXPIRED_NETWORK}`, "=action=deny"];
  }
  return [
    `=src-address=${EXPIRED_NETWORK}`,
    "=action=redirect",
    `=action-data=${isolir.target}`,
  ];
}

function describeProxyRule(isolir: IsolirProvisioning) {
  return isolir.mode === "ROUTER_PAGE"
    ? `Deny ${EXPIRED_NETWORK} (router isolir page)`
    : `Redirect ${EXPIRED_NETWORK} to ${isolir.target}`;
}

async function readProxyRules(connection: RouterOSAPI) {
  return (await connection.write("/ip/proxy/access/print", [
    `?comment=${PROXY_RULE_COMMENT}`,
  ])) as RouterRow[];
}

async function addProxyRule(
  connection: RouterOSAPI,
  isolir: IsolirProvisioning,
  logs: string[],
) {
  await connection.write("/ip/proxy/access/add", [
    ...getProxyRuleArgs(isolir),
    `=comment=${PROXY_RULE_COMMENT}`,
  ]);
  await delay(200);
  logs.push(`Added Web Proxy Access Rule: ${describeProxyRule(isolir)}`);
}

function getWebProxyMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function logWebProxyError(logs: string[], action: string, error: unknown) {
  const message = getWebProxyMessage(error);
  logger.error(`[Provisioning] Web Proxy Error: ${message}`);
  logs.push(`Failed to ${action}: ${message}`);
  return message;
}

async function removeProxyRules(connection: RouterOSAPI, logs: string[]) {
  const proxyRules = await readProxyRules(connection);

  for (const rule of proxyRules) {
    await connection.write("/ip/proxy/access/remove", [`=.id=${rule[".id"]}`]);
    await delay(100);
    logs.push("Removed Web Proxy Access Rule");
  }
}

/**
 * Nyalakan web proxy dan pasang rule access billing sesuai mode isolir.
 * Tanpa `isolir`, web proxy tidak disentuh. Galat tidak dilempar agar
 * provisioning berlanjut; pesannya dikembalikan untuk status halaman.
 */
export async function provisionWebProxy(params: {
  connection: RouterOSAPI;
  isolir: IsolirProvisioning | null;
  logs: string[];
}): Promise<string | undefined> {
  const { isolir } = params;
  if (!isolir) {
    return undefined;
  }

  try {
    await enableWebProxy(params.connection, params.logs);
    const existing = await readProxyRules(params.connection);
    if (existing.length === 0) {
      await addProxyRule(params.connection, isolir, params.logs);
      return undefined;
    }
    // Menangkap URL isolir atau mode yang berganti setelah router diprovision.
    await restoreRows({
      connection: params.connection,
      path: "/ip/proxy/access",
      rows: existing,
      args: getProxyRuleArgs(isolir),
      logs: params.logs,
      label: "Web Proxy Access Rule",
    });
    return undefined;
  } catch (error: unknown) {
    return logWebProxyError(params.logs, "configure Web Proxy", error);
  }
}

/**
 * Hapus rule access billing dan matikan web proxy, yang dinyalakan
 * provisioning di setiap mode isolir.
 */
export async function removeWebProxy(params: {
  connection: RouterOSAPI;
  logs: string[];
}) {
  // Rule yang gagal dibuang tidak boleh menghentikan teardown: mematikan
  // proxy sesudahnya yang menutup akses lewat port 8181.
  try {
    await removeProxyRules(params.connection, params.logs);
  } catch (error: unknown) {
    logWebProxyError(params.logs, "remove Web Proxy Access Rule", error);
  }

  try {
    await params.connection.write("/ip/proxy/set", ["=enabled=no"]);
    params.logs.push("Disabled Web Proxy");
  } catch (error: unknown) {
    logWebProxyError(params.logs, "disable Web Proxy", error);
  }
}
