/**
 * Public DTOs untuk module app-version.
 * Re-export dari service files agar konsumen bisa import dari sub-entrypoint
 * `@/modules/app-version/dto` tanpa tahu internal layout services.
 */
export type {
  VersionCheckInput,
  ContactAdminInfo,
  LatestVersionInfo,
  VersionCheckResult,
  TenantContactLookup,
} from "../services/AppVersionCheckService";
