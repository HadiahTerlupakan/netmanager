import { logger } from "@/lib/logger";
import { runProvisioningConnection } from "./mikrotik-provisioning.connection";
import type {
  MikroTikProvisioningResult,
  MikroTikProvisioningRouterDetails,
} from "./mikrotik-provisioning.connection";

const GROUP_NAME = "netmanager.api";
const GROUP_POLICY =
  "read,write,policy,test,sensitive,api,!local,!telnet,!ssh,!ftp,!reboot,!winbox,!password,!web,!sniff,!romon,!rest-api";
const USER_COMMENT = "NetManager API User - DO NOT DELETE";
const GROUP_COMMENT = "NetManager API Group - DO NOT DELETE";
const PASSWORD_CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

type MikroTikApiUserResult = MikroTikProvisioningResult & {
  username?: string;
  password?: string;
};

export async function createProvisioningApiUser(
  routerDetails: MikroTikProvisioningRouterDetails,
): Promise<MikroTikApiUserResult> {
  const logs: string[] = [];
  const username = `netmanager_${Math.random().toString(36).substring(2, 8)}`;
  const password = generateSecurePassword(16);

  try {
    await runProvisioningConnection({
      routerDetails,
      operation: async (connection) => {
        logs.push(`Connected to MikroTik at ${routerDetails.ip}`);
        await ensureApiGroup(connection, logs);
        await removeOldApiUsers(connection, logs);
        await createApiUser(connection, username, password, logs);
      },
    });

    return { success: true, logs, username, password };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logs.push(`Error: ${message}`);
    logger.error("[API User] Error creating API user:", message);
    return { success: false, logs };
  }
}

async function findExistingApiGroups(connection: {
  write(path: string, args: string[]): Promise<unknown>;
}) {
  return (await connection.write("/user/group/print", [
    `?name=${GROUP_NAME}`,
  ])) as Array<{ ".id": string }>;
}

async function updateApiGroup(
  connection: { write(path: string, args: string[]): Promise<unknown> },
  groupId: string,
  logs: string[],
) {
  await connection.write("/user/group/set", [
    `=.id=${groupId}`,
    `=policy=${GROUP_POLICY}`,
    `=comment=${GROUP_COMMENT}`,
  ]);
  logs.push(`Updated existing group: ${GROUP_NAME}`);
}

async function addApiGroup(
  connection: { write(path: string, args: string[]): Promise<unknown> },
  logs: string[],
) {
  await connection.write("/user/group/add", [
    `=name=${GROUP_NAME}`,
    `=policy=${GROUP_POLICY}`,
    `=comment=${GROUP_COMMENT}`,
  ]);
  logs.push(`Created group: ${GROUP_NAME}`);
}

async function ensureApiGroup(
  connection: {
    write(path: string, args: string[]): Promise<unknown>;
  },
  logs: string[],
) {
  const existingGroups = await findExistingApiGroups(connection);
  if (existingGroups.length > 0) {
    await updateApiGroup(connection, existingGroups[0][".id"], logs);
    return;
  }

  await addApiGroup(connection, logs);
}

async function removeOldApiUsers(
  connection: {
    write(path: string, args: string[]): Promise<unknown>;
  },
  logs: string[],
) {
  const oldUsers = (await connection.write("/user/print", [
    `?comment=${USER_COMMENT}`,
  ])) as Array<{ ".id": string; name: string }>;

  for (const user of oldUsers) {
    try {
      await connection.write("/user/remove", [`=.id=${user[".id"]}`]);
      logs.push(`Removed old API user: ${user.name}`);
    } catch {
      // noop
    }
  }
}

async function createApiUser(
  connection: { write(path: string, args: string[]): Promise<unknown> },
  username: string,
  password: string,
  logs: string[],
) {
  await connection.write("/user/add", [
    `=name=${username}`,
    `=password=${password}`,
    `=group=${GROUP_NAME}`,
    `=comment=${USER_COMMENT}`,
  ]);
  logs.push(`Created API user: ${username}`);
}

function generateSecurePassword(length: number): string {
  let password = "";

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * PASSWORD_CHARACTERS.length);
    password += PASSWORD_CHARACTERS.charAt(randomIndex);
  }

  return password;
}
