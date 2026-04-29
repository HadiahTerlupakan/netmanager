import type { AppVersionService } from "../services/AppVersionService";

let serviceInstance: AppVersionService | null = null;

/** Return the shared app-version service with repository composition isolated. */
export async function getAppVersionService(): Promise<AppVersionService> {
  if (!serviceInstance) {
    const [{ AppVersionRepository }, { AppVersionService }] = await Promise.all(
      [
        import("../repositories/AppVersionRepository"),
        import("../services/AppVersionService"),
      ],
    );
    serviceInstance = new AppVersionService(new AppVersionRepository());
  }

  return serviceInstance;
}
