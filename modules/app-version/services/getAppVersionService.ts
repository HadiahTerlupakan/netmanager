import type { AppVersionService } from "./AppVersionService";

let serviceInstance: AppVersionService | null = null;

export async function getAppVersionService(): Promise<AppVersionService> {
  if (!serviceInstance) {
    const [{ AppVersionRepository }, { AppVersionService }] = await Promise.all(
      [
        import("../repositories/AppVersionRepository"),
        import("./AppVersionService"),
      ],
    );
    serviceInstance = new AppVersionService(new AppVersionRepository());
  }

  return serviceInstance;
}
