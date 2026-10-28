import type { RouterOSAPI } from "node-routeros-v2";
import { createRouterOsApi } from "./routeros-timeout";

const CONNECTION_TIMEOUT_MS = 10000;

export type RouterConfig = {
  ipAddress: string;
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
};

export class MikroTikConnectionFactory {
  /** Connect to a MikroTik RouterOS API endpoint. */
  async connect(config: RouterConfig): Promise<RouterOSAPI> {
    const connection = createRouterOsApi({
      host: config.ipAddress,
      port: config.apiPort,
      user: config.apiUsername,
      password: config.apiPassword,
      timeoutMs: CONNECTION_TIMEOUT_MS,
    });
    await connection.connect();
    return connection;
  }
}
