import { Telnet } from "telnet-client";
import { logger } from "@/lib/logger";
import type { OltDevice } from "../../domain/entities/olt-device.entity";

const TELNET_TIMEOUT = 30000;
const LOGIN_PROMPT = /Username:|Login:/i;
const PASSWORD_PROMPT = /Password:/i;
const COMMAND_PROMPT = /[#>]\s*$/;

export class ZteTelnetClient {
  private connection: Telnet | null = null;

  async connect(device: OltDevice): Promise<void> {
    if (!device.telnetUser || !device.telnetPass) {
      throw new Error("Telnet credentials tidak tersedia");
    }

    this.connection = new Telnet();

    await this.connection.connect({
      host: device.ipAddress,
      port: device.telnetPort ?? 23,
      timeout: TELNET_TIMEOUT,
      shellPrompt: COMMAND_PROMPT,
      loginPrompt: LOGIN_PROMPT,
      passwordPrompt: PASSWORD_PROMPT,
      username: device.telnetUser,
      password: device.telnetPass,
      negotiationMandatory: false,
    });

    logger.info(
      `[ZteTelnet] Connected to ${device.name} (${device.ipAddress})`,
    );
  }

  async execute(command: string): Promise<string> {
    if (!this.connection) {
      throw new Error("Telnet tidak terkoneksi");
    }

    const result = await this.connection.send(command, {
      timeout: TELNET_TIMEOUT,
      shellPrompt: COMMAND_PROMPT,
    });

    return result;
  }

  async executeMultiple(commands: string[]): Promise<string[]> {
    const results: string[] = [];
    for (const cmd of commands) {
      const result = await this.execute(cmd);
      results.push(result);
    }
    return results;
  }

  async enableMode(): Promise<void> {
    await this.execute("enable");
  }

  async configMode(): Promise<void> {
    await this.enableMode();
    await this.execute("configure terminal");
  }

  async exitConfig(): Promise<void> {
    await this.execute("end");
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.end();
      } catch {
        // ignore disconnect errors
      }
      this.connection = null;
      logger.debug("[ZteTelnet] Disconnected");
    }
  }

  async testLogin(device: OltDevice): Promise<boolean> {
    try {
      await this.connect(device);
      const result = await this.execute("show version");
      await this.disconnect();
      return result.length > 0;
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }
}
