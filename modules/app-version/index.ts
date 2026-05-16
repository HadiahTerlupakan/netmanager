export { AppVersionCheckService } from "./services/AppVersionCheckService";
export type {
  ContactAdminInfo,
  LatestVersionInfo,
  TenantContactLookup,
  VersionCheckInput,
  VersionCheckResult,
} from "./services/AppVersionCheckService";

export { AppReleaseQueryService } from "./services/AppReleaseQueryService";
export { AppReleaseMutationService } from "./services/AppReleaseMutationService";

export { getAppReleaseServices } from "./services/getAppReleaseServices";

export {
  appReleaseCreateSchema,
  appReleaseUpdateSchema,
  versionCheckQuerySchema,
  APP_RELEASE_PLATFORMS,
  APP_RELEASE_ARCHITECTURES,
} from "./validators/app-release";
export type {
  AppReleaseCreateDto,
  AppReleaseUpdateDto,
  VersionCheckQuery,
} from "./validators/app-release";

export type {
  AppRelease,
  AppReleasePlatform,
  AppReleaseArchitecture,
} from "./domain/entities/AppReleaseEntity";
export type {
  AppReleaseCreateInput,
  AppReleaseUpdateInput,
  AppReleaseQueryFilters,
  IAppReleaseRepository,
} from "./domain/ports/IAppReleaseRepository";

export { AppReleaseNotFoundError, AppReleaseValidationError } from "./errors";
