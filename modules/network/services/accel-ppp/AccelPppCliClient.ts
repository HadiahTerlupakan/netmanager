import { Socket } from "net";
import { logger } from "@/lib/logger";
import {
  AccelPppCliCommandError,
  AccelPppCliConnectionError,
  AccelPppCliTimeoutError,
} from "../../domain/errors/AccelPppErrors";
import {
  isAuthFailureResponse,
  parseShowSessions,
  parseShowStat,
  parseTerminateResponse,
  type AccelPppSessionDTO,
  type AccelPppStatDTO,
} from "./parsers";

const DEFAULT_TIMEOUT_MS = 5000;
const RESPONSE_BUFFER_LIMIT_BYTES = 1024 * 1024; // 1 MiB safety cap

export interface AccelPppCliClientOptions {
  host: string;
  port: number;
  password?: string | null;
  timeoutMs?: number;
}

/**
 * Klien TCP CLI untuk accel-ppp (default port 2001, modul `cli` `tcp=`).
 *
 * Wire protocol (sesuai docs accel-ppp 1.12 + accel-cmd source):
 *   - Buka koneksi TCP
 *   - Bila `password` di-set, kirim `<password>\n` sebagai baris pertama
 *   - Kirim command (mis. `show sessions`) lalu `\n`
 *   - Kirim `exit\n` agar server menutup koneksi setelah selesai mengirim output
 *   - Kumpulkan seluruh output sampai `end`/`close`
 *
 * Why: pendekatan one-shot per command ini sederhana, mengikuti pola
 * `accel-cmd` resmi, dan menghindari handling prompt parser yang rapuh.
 */
export class AccelPppCliClient {
  private readonly host: string;
  private readonly port: number;
  private readonly password: string | null;
  private readonly timeoutMs: number;

  constructor(options: AccelPppCliClientOptions) {
    this.host = options.host;
    this.port = options.port;
    this.password = options.password ?? null;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Eksekusi raw command — biasanya untuk operasi yang tidak terdaftar di helper. */
  async sendCommand(command: string): Promise<string> {
    const trimmed = command.trim();
    if (!trimmed) {
      throw new AccelPppCliCommandError("Command tidak boleh kosong");
    }

    const raw = await this.execute(trimmed);

    if (this.password && isAuthFailureResponse(raw)) {
      throw new AccelPppCliCommandError(
        `Autentikasi CLI accel-ppp gagal di ${this.host}:${this.port}`,
      );
    }

    return raw;
  }

  /** Cek koneksi cepat — kirim `show version` dan return raw response. */
  async ping(): Promise<string> {
    return this.sendCommand("show version");
  }

  async showSessions(): Promise<AccelPppSessionDTO[]> {
    const raw = await this.sendCommand("show sessions");
    return parseShowSessions(raw);
  }

  async showStat(): Promise<AccelPppStatDTO> {
    const raw = await this.sendCommand("show stat");
    return parseShowStat(raw);
  }

  /**
   * Akhiri sesi by username. Idempotent: jika username tidak aktif
   * mengembalikan `{ notFound: true, terminated: 0 }` tanpa throw,
   * sehingga API route yang membungkus tahu untuk return 404.
   */
  async terminateByUsername(
    username: string,
  ): Promise<{ terminated: boolean; notFound: boolean; message: string }> {
    const safe = sanitizeCliArgument(username);
    const raw = await this.sendCommand(`terminate username ${safe}`);
    const result = parseTerminateResponse(raw);
    return {
      terminated: result.success,
      notFound: result.notFound,
      message: result.message,
    };
  }

  /**
   * Buka socket, kirim password (kalau ada) + command + `exit`,
   * tunggu sampai server close. Return concatenated string.
   */
  private execute(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const chunks: Buffer[] = [];
      let receivedBytes = 0;
      let settled = false;

      const settle = (
        outcome: { ok: true; data: string } | { ok: false; error: Error },
      ) => {
        if (settled) return;
        settled = true;
        socket.removeAllListeners();
        socket.destroy();
        if (outcome.ok === true) {
          resolve(outcome.data);
          return;
        }
        reject(outcome.error);
      };

      socket.setTimeout(this.timeoutMs);

      socket.on("connect", () => {
        const payload = this.buildPayload(command);
        socket.write(payload, (err) => {
          if (err) {
            logger.warn("[accel-ppp] write error", {
              host: this.host,
              port: this.port,
              error: err.message,
            });
            settle({
              ok: false,
              error: new AccelPppCliConnectionError(
                `Gagal menulis ke ${this.host}:${this.port}: ${err.message}`,
              ),
            });
          }
        });
      });

      socket.on("data", (chunk: Buffer) => {
        receivedBytes += chunk.length;
        if (receivedBytes > RESPONSE_BUFFER_LIMIT_BYTES) {
          settle({
            ok: false,
            error: new AccelPppCliCommandError(
              `Response melebihi batas ${RESPONSE_BUFFER_LIMIT_BYTES} byte`,
            ),
          });
          return;
        }
        chunks.push(chunk);
      });

      socket.on("end", () => {
        settle({ ok: true, data: Buffer.concat(chunks).toString("utf8") });
      });

      socket.on("close", () => {
        settle({ ok: true, data: Buffer.concat(chunks).toString("utf8") });
      });

      socket.on("timeout", () => {
        settle({
          ok: false,
          error: new AccelPppCliTimeoutError(
            `Timeout setelah ${this.timeoutMs}ms ke ${this.host}:${this.port}`,
          ),
        });
      });

      socket.on("error", (err) => {
        settle({
          ok: false,
          error: new AccelPppCliConnectionError(
            `Tidak bisa terhubung ke ${this.host}:${this.port}: ${err.message}`,
          ),
        });
      });

      socket.connect({ host: this.host, port: this.port });
    });
  }

  private buildPayload(command: string): string {
    const lines: string[] = [];
    if (this.password) {
      lines.push(this.password);
    }
    lines.push(command);
    lines.push("exit");
    return `${lines.join("\n")}\n`;
  }
}

/**
 * Lolos hanya karakter aman untuk argumen CLI (alfanumerik, dot, dash, underscore, @).
 * Why: argumen username/ifname di-inject ke string command — kalau ada `\n`
 * attacker bisa inject command tambahan.
 */
function sanitizeCliArgument(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9._@\-:]/g, "");
  if (safe.length === 0) {
    throw new AccelPppCliCommandError(
      "Argumen CLI accel-ppp tidak boleh kosong setelah sanitasi",
    );
  }
  return safe;
}
