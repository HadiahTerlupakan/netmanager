import { AppVersionValidationError } from "../errors";
import type { UploadVersionInput } from "./AppVersionService.types";

const POSITIVE_INTEGER_PATTERN = /^\d+$/;
const DEFAULT_PLATFORM = "android";

interface ParsedUploadFields {
  version?: string;
  buildNumber?: number;
  versionCode?: number;
  platform: string;
  releaseNotes?: string;
  minVersion?: string;
  uploadedKey?: string;
  uploadedFilename?: string;
  uploadedSize?: number;
}

function getStringValue(entry: FormDataEntryValue | null): string | null {
  return typeof entry === "string" ? entry : null;
}

function getOptionalString(
  formData: FormData,
  fieldName: string,
): string | undefined {
  return getStringValue(formData.get(fieldName)) || undefined;
}

function parsePositiveInteger(
  value: string | null,
  fieldName: string,
): number | undefined {
  if (!value || !value.trim()) {
    return undefined;
  }

  const normalized = value.trim();
  if (!POSITIVE_INTEGER_PATTERN.test(normalized)) {
    throw new AppVersionValidationError(
      `${fieldName} harus berupa angka bulat positif`,
    );
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppVersionValidationError(
      `${fieldName} harus berupa angka bulat positif`,
    );
  }

  return parsed;
}

function assertApkFileName(
  filename: string | null | undefined,
  message: string,
): void {
  if (!filename) {
    return;
  }

  if (!filename.toLowerCase().endsWith(".apk")) {
    throw new AppVersionValidationError(message);
  }
}

function parseUploadFields(formData: FormData): ParsedUploadFields {
  return {
    version: getOptionalString(formData, "version"),
    buildNumber: parseUploadNumberField(formData, "buildNumber"),
    versionCode: parseUploadNumberField(formData, "versionCode"),
    platform: getOptionalString(formData, "platform") || DEFAULT_PLATFORM,
    releaseNotes: getOptionalString(formData, "releaseNotes"),
    minVersion: getOptionalString(formData, "minVersion"),
    uploadedKey: getOptionalString(formData, "uploadedKey"),
    uploadedFilename: getOptionalString(formData, "uploadedFilename"),
    uploadedSize: parseUploadNumberField(formData, "uploadedSize"),
  };
}

function parseUploadNumberField(
  formData: FormData,
  fieldName: string,
): number | undefined {
  return parsePositiveInteger(
    getStringValue(formData.get(fieldName)),
    fieldName,
  );
}

function getApkFile(formData: FormData): File | undefined {
  const apkEntry = formData.get("apk");
  return apkEntry instanceof File ? apkEntry : undefined;
}

function assertVersionSource(fields: ParsedUploadFields, apkFile?: File): void {
  const hasApk = Boolean(apkFile || fields.uploadedKey);
  const hasVersionMetadata = Boolean(
    fields.version && fields.buildNumber && fields.versionCode,
  );

  if (!hasApk && !hasVersionMetadata) {
    throw new AppVersionValidationError(
      "Upload APK untuk auto-detect versi, atau isi manual version, buildNumber, dan versionCode",
    );
  }
}

function buildUploadInput(
  formData: FormData,
  fields: ParsedUploadFields,
  apkFile?: File,
): UploadVersionInput {
  return {
    ...fields,
    ...(apkFile ? { apkFile, apkSize: apkFile.size } : {}),
    ...(apkFile?.name ? { apkFilename: apkFile.name } : {}),
    isForceUpdate: formData.get("isForceUpdate") === "true",
    forceLocal: formData.get("forceLocal") === "true",
  };
}

/** Parse form upload versi aplikasi menjadi input service yang tervalidasi. */
export function parseAppVersionUploadForm(
  formData: FormData,
): UploadVersionInput {
  const fields = parseUploadFields(formData);
  const apkFile = getApkFile(formData);

  assertApkFileName(apkFile?.name, "File yang diupload harus berformat APK");
  assertApkFileName(
    fields.uploadedFilename,
    "File direct upload harus berformat APK",
  );
  assertVersionSource(fields, apkFile);

  return buildUploadInput(formData, fields, apkFile);
}
