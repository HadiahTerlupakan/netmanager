import type {
  AppVersion,
  AppVersionWithUser,
  UpdateAppVersionDTO,
} from "../domain/entities/AppVersionEntity";
import type { IAppVersionRepository } from "../domain/ports/IAppVersionRepository";
import { AppVersionConflictError, AppVersionNotFoundError } from "../errors";
import type { AppVersionStatsResult } from "./AppVersionService.types";
import {
  APP_VERSION_FILENAME_PREFIX,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from "./app-version.constants";

/** Build paginated response metadata untuk daftar versi. */
export function buildVersionPaginationResult(
  result: { data: AppVersionWithUser[]; total: number },
  options?: { page?: number; limit?: number },
) {
  return {
    ...result,
    page: options?.page || DEFAULT_PAGE,
    limit: options?.limit || DEFAULT_LIMIT,
  };
}

/** Return statistik default saat belum ada versi aktif. */
export function buildEmptyVersionStats(): AppVersionStatsResult {
  return {
    updatedCount: 0,
    outdatedCount: 0,
    unknownCount: 0,
    latestVersion: null,
  };
}

/** Gabungkan rollout stats dengan metadata versi terbaru. */
export function buildVersionStatsResult(
  latestVersion: AppVersion,
  rolloutStats: {
    updatedCount: number;
    outdatedCount: number;
    unknownCount: number;
  },
): AppVersionStatsResult {
  return {
    ...rolloutStats,
    latestVersion: {
      version: latestVersion.version,
      versionCode: latestVersion.versionCode,
    },
  };
}

/** Ambil entitas versi yang wajib ada. */
export async function requireExistingVersion(
  repository: IAppVersionRepository,
  id: string,
): Promise<AppVersionWithUser> {
  const existing = await repository.findById(id);
  if (!existing) {
    throw new AppVersionNotFoundError();
  }

  return existing;
}

/** Validasi konflik versi dan version code saat update. */
export async function assertVersionUpdateHasNoConflict(
  repository: IAppVersionRepository,
  updateData: UpdateAppVersionDTO,
  existing: AppVersionWithUser,
): Promise<void> {
  await assertVersionNameHasNoConflict(repository, updateData, existing);
  await assertVersionCodeHasNoConflict(repository, updateData, existing);
}

/** Build payload download APK untuk route download. */
export function buildDownloadApkPayload(version: AppVersionWithUser) {
  return {
    url: version.apkUrl as string,
    filename: `${APP_VERSION_FILENAME_PREFIX}${version.version}.apk`,
    size: version.apkSize ? Number(version.apkSize) : 0,
  };
}

async function assertVersionNameHasNoConflict(
  repository: IAppVersionRepository,
  updateData: UpdateAppVersionDTO,
  existing: AppVersionWithUser,
): Promise<void> {
  if (!updateData.version || updateData.version === existing.version) {
    return;
  }

  const versionExists = await repository.findByVersion(updateData.version);
  if (versionExists) {
    throw new AppVersionConflictError(
      `Version ${updateData.version} sudah ada`,
    );
  }
}

async function assertVersionCodeHasNoConflict(
  repository: IAppVersionRepository,
  updateData: UpdateAppVersionDTO,
  existing: AppVersionWithUser,
): Promise<void> {
  if (
    !updateData.versionCode ||
    updateData.versionCode === existing.versionCode
  ) {
    return;
  }

  const codeExists = await repository.findByVersionCode(updateData.versionCode);
  if (codeExists) {
    throw new AppVersionConflictError(
      `Version code ${updateData.versionCode} sudah ada`,
    );
  }
}
