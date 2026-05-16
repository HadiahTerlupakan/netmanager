// Public API for App Update (Expo Updates) Module
export { AppUpdateService } from "./services/AppUpdateService";
export { getAppUpdateService } from "./services/getAppUpdateService";
export { parseStreamingAppUpdateForm } from "./services/parseStreamingAppUpdateForm";
export type { ParsedAppUpdateForm } from "./services/parseStreamingAppUpdateForm";
export {
  isAppUpdatePublishTokenConfigured,
  verifyAppUpdatePublishToken,
} from "./services/AppUpdatePublishAuthService";

export {
  appUpdateChannelSchema,
  appUpdatePlatformSchema,
  manifestQuerySchema,
  runtimeVersionSchema,
  APP_UPDATE_CHANNELS,
  APP_UPDATE_PLATFORMS,
  APP_UPDATE_MAX_BUNDLE_BYTES,
} from "./validators";
export type { ManifestQuery } from "./validators";

export type {
  AppUpdate,
  AppUpdateAsset,
  AppUpdateChannel,
  AppUpdatePlatform,
} from "./domain/entities/AppUpdateEntity";

export { AppUpdateNotFoundError, AppUpdateValidationError } from "./errors";

export { isSigningEnabled } from "./services/AppUpdateSigningService";
