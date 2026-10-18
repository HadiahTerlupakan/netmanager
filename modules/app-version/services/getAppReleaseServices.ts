import type { AppReleaseMutationService } from "./AppReleaseMutationService";
import type { AppReleaseQueryService } from "./AppReleaseQueryService";
import type { AppVersionCheckService } from "./AppVersionCheckService";

interface AppReleaseServiceBundle {
  queryService: AppReleaseQueryService;
  mutationService: AppReleaseMutationService;
  versionCheckService: AppVersionCheckService;
}

let bundleInstance: AppReleaseServiceBundle | null = null;

export async function getAppReleaseServices(): Promise<AppReleaseServiceBundle> {
  if (!bundleInstance) {
    const [
      { AppReleaseRepository },
      { AppReleaseQueryService },
      { AppReleaseMutationService },
      { AppVersionCheckService },
      { getAppUpdateContact },
      { getPlayStoreStatus },
    ] = await Promise.all([
      import("../repositories/AppReleaseRepository"),
      import("./AppReleaseQueryService"),
      import("./AppReleaseMutationService"),
      import("./AppVersionCheckService"),
      import("@/modules/settings"),
      import("./MobileVersionGate"),
    ]);

    const repository = new AppReleaseRepository();
    bundleInstance = {
      queryService: new AppReleaseQueryService(repository),
      mutationService: new AppReleaseMutationService(repository),
      versionCheckService: new AppVersionCheckService(
        repository,
        getAppUpdateContact,
        getPlayStoreStatus,
      ),
    };
  }
  return bundleInstance;
}
