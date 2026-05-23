import { Telnet } from "telnet-client";
import { logger } from "@/lib/logger";
import type { OltDevice } from "../../domain/entities/olt-device.entity";

const TELNET_TIMEOUT = 30000;
const LOGIN_PROMPT = /Username:|Login:/i;
const PASSWORD_PROMPT = /Password:/i;
const COMMAND_PROMPT = /[#>]\s*$/;
const ENABLE_PROMPT = /[#]\s*$/;

const ERROR_PATTERNS: RegExp[] = [
  /\berror\b/i,
  /\bfail(?:ed|ure)?\b/i,
  /\binvalid\b/i,
  /\bnot exist\b/i,
  /\balready exist\b/i,
  /\bunknown command\b/i,
  /\bincomplete\b/i,
  /\bambiguous\b/i,
  /%/,
];

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

    await this.disablePagination();
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

  async executeAndAssertSuccess(command: string): Promise<string> {
    const output = await this.execute(command);
    if (this.isErrorOutput(output)) {
      throw new Error(
        `Command rejected: "${command}" → ${output.trim().slice(0, 200)}`,
      );
    }
    return output;
  }

  async executeMultiple(commands: string[]): Promise<string[]> {
    const results: string[] = [];
    for (const cmd of commands) {
      const result = await this.executeAndAssertSuccess(cmd);
      results.push(result);
    }
    return results;
  }

  async enableMode(device: OltDevice): Promise<void> {
    if (!this.connection) throw new Error("Telnet tidak terkoneksi");

    const enablePass = device.telnetEnablePass ?? device.telnetPass;
    const result = await this.connection.send("enable", {
      timeout: TELNET_TIMEOUT,
      shellPrompt: new RegExp(
        `${PASSWORD_PROMPT.source}|${ENABLE_PROMPT.source}`,
        "i",
      ),
    });

    if (PASSWORD_PROMPT.test(result)) {
      if (!enablePass) {
        throw new Error("Enable password dibutuhkan tapi tidak dikonfigurasi");
      }
      await this.connection.send(enablePass, {
        timeout: TELNET_TIMEOUT,
        shellPrompt: ENABLE_PROMPT,
      });
    }
  }

  async configMode(device: OltDevice): Promise<void> {
    await this.enableMode(device);
    await this.executeAndAssertSuccess("configure terminal");
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

  private async disablePagination(): Promise<void> {
    try {
      await this.execute("terminal length 0");
    } catch {
      // ZTE C300 lama pakai "screen-length 0 temporary"
      try {
        await this.execute("screen-length 0 temporary");
      } catch {
        logger.warn(
          "[ZteTelnet] Tidak bisa disable pagination — output mungkin terpotong",
        );
      }
    }
  }

  private isErrorOutput(output: string): boolean {
    return ERROR_PATTERNS.some((pattern) => pattern.test(output));
  }
}
