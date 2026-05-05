import { RouterOSAPI } from "node-routeros-v2";

export type MikroTikProvisioningRouterDetails = {
  ip: string;
  port: number;
  username: string;
  password: string;
};

export type MikroTikProvisioningResult = {
  success: boolean;
  logs: string[];
};

const CONNECTION_TIMEOUT = 10000;
const DEFAULT_DELAY_MS = 200;

export function createProvisioningConnection(
  routerDetails: MikroTikProvisioningRouterDetails,
) {
  return new RouterOSAPI({
    host: routerDetails.ip,
    port: routerDetails.port,
    user: routerDetails.username,
    password: routerDetails.password,
    timeout: CONNECTION_TIMEOUT,
  });
}

export async function delay(ms: number = DEFAULT_DELAY_MS): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runProvisioningConnection<T>(params: {
  routerDetails: MikroTikProvisioningRouterDetails;
  operation: (connection: RouterOSAPI) => Promise<T>;
}): Promise<T> {
  const connection = createProvisioningConnection(params.routerDetails);

  try {
    await connection.connect();
    return await params.operation(connection);
  } finally {
    try {
      connection.close();
    } catch {
      // noop
    }
  }
}
