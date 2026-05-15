import type { AppUpdateService } from "./AppUpdateService";

let serviceInstance: AppUpdateService | null = null;

export async function getAppUpdateService(): Promise<AppUpdateService> {
  if (!serviceInstance) {
    const [{ AppUpdateService }, { AppUpdateRepository }] = await Promise.all([
      import("./AppUpdateService"),
      import("../repositories/AppUpdateRepository"),
    ]);
    serviceInstance = new AppUpdateService(new AppUpdateRepository());
  }
  return serviceInstance;
}
