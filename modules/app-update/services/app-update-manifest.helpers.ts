import type {
  AppUpdate,
  AppUpdateAsset,
} from "../domain/entities/AppUpdateEntity";

/**
 * Build Expo Updates manifest body untuk endpoint /api/mobile/manifest.
 * Mengikuti spec multipart manifest, tetapi kita serve sebagai JSON
 * (single application/json) karena tidak butuh signed cert response —
 * signature kita lampirkan via header expo-signature.
 *
 * Reference: https://docs.expo.dev/technical-specs/expo-updates-1/
 */
export function buildManifestBody(input: {
  baseUrl: string;
  update: AppUpdate;
}): string {
  const { baseUrl, update } = input;
  const manifest = {
    id: update.manifestId,
    createdAt: update.commitTime.toISOString(),
    runtimeVersion: update.runtimeVersion,
    launchAsset: buildLaunchAsset({
      baseUrl,
      updateId: update.id,
      bundleHash: update.bundleHash,
    }),
    assets: update.assets.map((asset) =>
      buildAssetEntry({
        baseUrl,
        updateId: update.id,
        asset,
      }),
    ),
    metadata: update.metadata ?? {},
    extra: {
      releaseNotes: update.releaseNotes ?? null,
    },
  };
  return JSON.stringify(manifest);
}

function buildLaunchAsset(input: {
  baseUrl: string;
  updateId: string;
  bundleHash: string;
}) {
  return {
    hash: input.bundleHash,
    key: `bundle-${input.bundleHash}`,
    contentType: "application/javascript",
    fileExtension: ".bundle",
    url: `${input.baseUrl}/api/mobile/app-update/asset?updateId=${input.updateId}&hash=${input.bundleHash}&type=bundle`,
  };
}

function buildAssetEntry(input: {
  baseUrl: string;
  updateId: string;
  asset: AppUpdateAsset;
}) {
  return {
    hash: input.asset.hash,
    key: input.asset.hash,
    contentType: input.asset.contentType,
    fileExtension: `.${input.asset.ext}`,
    url: `${input.baseUrl}/api/mobile/app-update/asset?updateId=${input.updateId}&hash=${input.asset.hash}&type=asset`,
  };
}
