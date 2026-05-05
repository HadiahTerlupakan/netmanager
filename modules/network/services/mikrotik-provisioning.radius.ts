import type { RouterOSAPI } from "node-routeros-v2";
import { delay } from "./mikrotik-provisioning.connection";

const RADIUS_COMMENT = "added by netmanager";
const RADIUS_SERVICE = "ppp,login,hotspot";
const RADIUS_TIMEOUT = "3000ms";
const COA_PORT = "3799";

type RouterRecord = { ".id": string };

type RadiusConfigParams = {
  connection: RouterOSAPI;
  serverIp: string;
  radiusSecret: string;
  authPort: number;
  accountingPort: number;
  logs: string[];
};

async function findExistingRadius(
  connection: RouterOSAPI,
  serverIp: string,
): Promise<RouterRecord[]> {
  return (await connection.write("/radius/print", [
    `?address=${serverIp}`,
    `?comment=${RADIUS_COMMENT}`,
  ])) as RouterRecord[];
}

async function updateRadiusEntries(
  params: RadiusConfigParams,
  radiusEntries: RouterRecord[],
) {
  for (const radius of radiusEntries) {
    await params.connection.write("/radius/set", [
      `=.id=${radius[".id"]}`,
      `=secret=${params.radiusSecret}`,
      `=service=${RADIUS_SERVICE}`,
      `=authentication-port=${params.authPort}`,
      `=accounting-port=${params.accountingPort}`,
      `=timeout=${RADIUS_TIMEOUT}`,
    ]);
    await delay(300);
    params.logs.push(
      `Updated existing RADIUS config for ${params.serverIp} (auth:${params.authPort}, acct:${params.accountingPort})`,
    );
  }
}

async function addRadiusEntry(params: RadiusConfigParams) {
  await params.connection.write("/radius/add", [
    `=address=${params.serverIp}`,
    `=secret=${params.radiusSecret}`,
    `=service=${RADIUS_SERVICE}`,
    `=authentication-port=${params.authPort}`,
    `=accounting-port=${params.accountingPort}`,
    `=timeout=${RADIUS_TIMEOUT}`,
    `=comment=${RADIUS_COMMENT}`,
  ]);
  await delay(300);
  params.logs.push(
    `Added new RADIUS config for ${params.serverIp} (auth:${params.authPort}, acct:${params.accountingPort})`,
  );
}

export async function provisionRadiusConfig(params: RadiusConfigParams) {
  const existingRadius = await findExistingRadius(
    params.connection,
    params.serverIp,
  );

  if (existingRadius.length > 0) {
    await updateRadiusEntries(params, existingRadius);
    return;
  }

  await addRadiusEntry(params);
}

export async function enableRadiusIncoming(params: {
  connection: RouterOSAPI;
  logs: string[];
}) {
  await params.connection.write("/radius/incoming/set", [
    "=accept=yes",
    `=port=${COA_PORT}`,
  ]);
  await delay(200);
  params.logs.push(`Configured RADIUS Incoming (CoA) on port ${COA_PORT}`);
}

export async function removeRadiusConfig(params: {
  connection: RouterOSAPI;
  serverIp: string;
  logs: string[];
}) {
  const existingRadius = (await params.connection.write("/radius/print", [
    `?address=${params.serverIp}`,
    `?comment=${RADIUS_COMMENT}`,
  ])) as RouterRecord[];

  for (const radius of existingRadius) {
    await params.connection.write("/radius/remove", [`=.id=${radius[".id"]}`]);
    await delay(200);
    params.logs.push(
      `Removed RADIUS config for ${params.serverIp} (ID: ${radius[".id"]})`,
    );
  }
}

export async function disableRadiusIncoming(params: {
  connection: RouterOSAPI;
  logs: string[];
}) {
  try {
    await params.connection.write("/radius/incoming/set", ["=accept=no"]);
    params.logs.push("Disabled RADIUS Incoming (CoA)");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    params.logs.push(`Failed to disable Radius Incoming: ${message}`);
  }
}
