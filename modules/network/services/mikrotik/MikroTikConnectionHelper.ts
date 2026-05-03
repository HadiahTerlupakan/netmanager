import { RouterOSAPI } from "node-routeros-v2";

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_DELAY_MS = 200;

export interface RouterCredentials {
  ip: string;
  port: number;
  username: string;
  password: string;
}

/** Helper untuk koneksi dan operasi MikroTik RouterOS. */
export class MikroTikConnectionHelper {
  /** Create RouterOS API connection. */
  createConnection(credentials: RouterCredentials): RouterOSAPI {
    return new RouterOSAPI({
      host: credentials.ip,
      port: credentials.port,
      user: credentials.username,
      password: credentials.password,
      timeout: DEFAULT_TIMEOUT_MS,
    });
  }

  /** Throttle commands untuk mencegah CPU spike di router low-end. */
  async delay(ms: number = DEFAULT_DELAY_MS): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Generate secure random password. */
  generateSecurePassword(length: number): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
