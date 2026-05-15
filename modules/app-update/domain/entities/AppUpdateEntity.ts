export type AppUpdateChannel = "staging" | "production";
export type AppUpdatePlatform = "android" | "ios";

export interface AppUpdateAsset {
  hash: string;
  ext: string;
  contentType: string;
  path: string;
  size: number;
}

export interface AppUpdate {
  id: string;
  manifestId: string;
  channel: string;
  runtimeVersion: string;
  platform: string;
  bundleHash: string;
  bundlePath: string;
  bundleSize: bigint;
  assets: AppUpdateAsset[];
  metadata: Record<string, unknown> | null;
  signature: string | null;
  signatureKeyId: string | null;
  releaseNotes: string | null;
  commitTime: Date;
  isActive: boolean;
  tenantId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppUpdateDTO {
  manifestId: string;
  channel: AppUpdateChannel;
  runtimeVersion: string;
  platform: AppUpdatePlatform;
  bundleHash: string;
  bundlePath: string;
  bundleSize: bigint;
  assets: AppUpdateAsset[];
  metadata?: Record<string, unknown>;
  signature?: string;
  signatureKeyId?: string;
  releaseNotes?: string;
  commitTime: Date;
  isActive?: boolean;
  tenantId?: string;
  createdBy?: string;
}
