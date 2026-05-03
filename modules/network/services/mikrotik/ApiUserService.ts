import { RouterOSAPI } from "node-routeros-v2";
import { MikroTikConnectionHelper } from "./MikroTikConnectionHelper";

const GROUP_NAME = "netmanager.api";
const GROUP_POLICY =
  "read,write,policy,test,sensitive,api,!local,!telnet,!ssh,!ftp,!reboot,!winbox,!password,!web,!sniff,!romon,!rest-api";
const GROUP_COMMENT = "NetManager API Group - DO NOT DELETE";
const USER_COMMENT = "NetManager API User - DO NOT DELETE";

export interface ApiUserResult {
  success: boolean;
  logs: string[];
  username?: string;
  password?: string;
}

/** Service untuk create API user di MikroTik. */
export class ApiUserService {
  constructor(private readonly helper: MikroTikConnectionHelper) {}

  /** Create API user dengan group dan permissions. */
  async createApiUser(conn: RouterOSAPI): Promise<ApiUserResult> {
    const logs: string[] = [];

    const username = this.generateUsername();
    const password = this.helper.generateSecurePassword(16);

    try {
      await this.ensureApiGroup(conn, logs);
      await this.createUser(conn, username, password, logs);

      return { success: true, logs, username, password };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logs.push(`Error: ${msg}`);
      return { success: false, logs };
    }
  }

  private generateUsername(): string {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `netmanager_${randomSuffix}`;
  }

  private async ensureApiGroup(
    conn: RouterOSAPI,
    logs: string[],
  ): Promise<void> {
    const existing = await this.findApiGroup(conn);

    if (existing.length > 0) {
      await this.updateApiGroup(conn, existing[0][".id"]);
      logs.push(`Updated existing group: ${GROUP_NAME}`);
    } else {
      await this.createApiGroup(conn);
      logs.push(`Created new group: ${GROUP_NAME}`);
    }
  }

  private async findApiGroup(
    conn: RouterOSAPI,
  ): Promise<Array<{ ".id": string }>> {
    return (await conn.write("/user/group/print", [
      "?name=" + GROUP_NAME,
    ])) as Array<{ ".id": string }>;
  }

  private async updateApiGroup(conn: RouterOSAPI, id: string): Promise<void> {
    await conn.write("/user/group/set", [
      "=.id=" + id,
      "=policy=" + GROUP_POLICY,
      "=comment=" + GROUP_COMMENT,
    ]);
    await this.helper.delay(200);
  }

  private async createApiGroup(conn: RouterOSAPI): Promise<void> {
    await conn.write("/user/group/add", [
      "=name=" + GROUP_NAME,
      "=policy=" + GROUP_POLICY,
      "=comment=" + GROUP_COMMENT,
    ]);
    await this.helper.delay(200);
  }

  private async createUser(
    conn: RouterOSAPI,
    username: string,
    password: string,
    logs: string[],
  ): Promise<void> {
    const existing = await this.findExistingUser(conn, username);

    if (existing.length > 0) {
      await this.updateUser(conn, existing[0][".id"], password);
      logs.push(`Updated existing user: ${username}`);
    } else {
      await this.addUser(conn, username, password);
      logs.push(`Created new user: ${username}`);
    }
  }

  private async findExistingUser(
    conn: RouterOSAPI,
    username: string,
  ): Promise<Array<{ ".id": string }>> {
    return (await conn.write("/user/print", ["?name=" + username])) as Array<{
      ".id": string;
    }>;
  }

  private async updateUser(
    conn: RouterOSAPI,
    id: string,
    password: string,
  ): Promise<void> {
    await conn.write("/user/set", [
      "=.id=" + id,
      "=password=" + password,
      "=group=" + GROUP_NAME,
    ]);
    await this.helper.delay(200);
  }

  private async addUser(
    conn: RouterOSAPI,
    username: string,
    password: string,
  ): Promise<void> {
    await conn.write("/user/add", [
      "=name=" + username,
      "=password=" + password,
      "=group=" + GROUP_NAME,
      "=comment=" + USER_COMMENT,
    ]);
    await this.helper.delay(200);
  }
}
