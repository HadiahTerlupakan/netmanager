import type { RouterOSAPI } from "node-routeros-v2";
import type { MikroTikRouterEntity } from "../domain/entities/MikroTikRouterEntity";
import { getRouterConnectionInput } from "./mikrotik-ppp-secret.helpers";
import type { MikroTikConnectionFactory } from "./mikrotik/MikroTikConnectionFactory";
import type { MikroTikRouterContextService } from "./mikrotik/MikroTikRouterContextService";

type RouterOperationParams<T> = {
  routerId: string;
  routerContextService: MikroTikRouterContextService;
  connectionFactory: MikroTikConnectionFactory;
  onMissingRouter: () => T;
  operation: (context: {
    router: MikroTikRouterEntity;
    connection: RouterOSAPI;
  }) => Promise<T>;
};

export async function runRouterOperation<T>(
  params: RouterOperationParams<T>,
): Promise<T> {
  const router = await params.routerContextService.findRouter(params.routerId);
  if (!router) {
    return params.onMissingRouter();
  }

  const connection = await params.connectionFactory.connect(
    getRouterConnectionInput(router),
  );

  try {
    return await params.operation({ router, connection });
  } finally {
    try {
      connection.close();
    } catch {
      // noop
    }
  }
}
