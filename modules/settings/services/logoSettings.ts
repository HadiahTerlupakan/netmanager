import path from "path";
import { access, unlink } from "fs/promises";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { isImageFile, saveFile } from "@/lib/utils/image-upload";
import { SettingsRepository } from "../repositories/SettingsRepository";

export type LogoType = "invoice" | "aplikasi";

export type LogoSettingsPayload = {
  logoInvoice: string | null;
  logoAplikasi: string | null;
};

const LOGO_SETTINGS_KEYS = ["LOGO_INVOICE", "LOGO_APLIKASI"] as const;

function getSettingKey(type: LogoType): (typeof LOGO_SETTINGS_KEYS)[number] {
  return type === "invoice" ? "LOGO_INVOICE" : "LOGO_APLIKASI";
}

function getSettingDescription(type: LogoType): string {
  return type === "invoice" ? "Logo untuk invoice" : "Logo utama aplikasi";
}

function isRemoteFilePath(filePath: string): boolean {
  return /^https?:\/\//i.test(filePath);
}

function normalizeStoredLogoPath(filePath: string): string {
  if (isRemoteFilePath(filePath)) {
    return filePath;
  }

  return filePath.startsWith("/") ? filePath : `/${filePath}`;
}

function resolvePublicFilePath(publicPath: string): string {
  return path.join(process.cwd(), "public", publicPath.replace(/^\/+/, ""));
}

function resolveLogoExtension(file: File): string {
  const extension = path.extname(file.name).toLowerCase();

  if (extension) {
    return extension;
  }

  switch (file.type) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return ".jpg";
  }
}

async function safeDeletePublicFile(publicPath: string): Promise<void> {
  if (isRemoteFilePath(publicPath)) {
    return;
  }

  try {
    await unlink(resolvePublicFilePath(publicPath));
  } catch (error) {
    const errorCode =
      error instanceof Error && "code" in error ? error.code : undefined;
    if (errorCode !== "ENOENT") {
      console.warn("[logoSettings] Failed to delete logo file:", error);
    }
  }
}

async function resolveActiveTenantId(
  tenantId?: string | null,
): Promise<string | null> {
  if (tenantId !== undefined) {
    return tenantId;
  }

  const tenantContext = await getTenantIdFromContext();
  return tenantContext.tenantId ?? null;
}

export async function getLogoSettings(
  tenantId?: string | null,
): Promise<LogoSettingsPayload> {
  const activeTenantId = await resolveActiveTenantId(tenantId);
  const records = await SettingsRepository.findManyByKeys(
    LOGO_SETTINGS_KEYS,
    activeTenantId,
  );
  const settingsMap = new Map(
    records.map((record) => [record.key, record.value]),
  );

  return {
    logoInvoice: settingsMap.get("LOGO_INVOICE") || null,
    logoAplikasi: settingsMap.get("LOGO_APLIKASI") || null,
  };
}

export async function uploadLogo(
  type: LogoType,
  file: File,
  tenantId?: string | null,
): Promise<string> {
  if (!isImageFile(file)) {
    throw new Error("File harus berupa gambar (PNG, JPG, JPEG)");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Ukuran file maksimal 5MB");
  }

  const activeTenantId = await resolveActiveTenantId(tenantId);
  const settingKey = getSettingKey(type);
  const oldSetting = await SettingsRepository.findManyByKeys(
    [settingKey],
    activeTenantId,
  );
  const oldValue = oldSetting[0]?.value ?? null;

  const uploadDir = path.join(process.cwd(), "public", "uploads", "logos");
  const fileName = type === "invoice" ? "logo-invoice" : "logo-aplikasi";
  const extension = resolveLogoExtension(file);
  const savedPath = await saveFile(
    file,
    uploadDir,
    `${fileName}${extension}`,
    "logos",
  );
  const normalizedPath = normalizeStoredLogoPath(savedPath);

  if (!isRemoteFilePath(normalizedPath)) {
    await access(resolvePublicFilePath(normalizedPath));
  }

  await SettingsRepository.upsertMany([
    {
      key: settingKey,
      value: normalizedPath,
      description: getSettingDescription(type),
      encrypted: false,
      tenantId: activeTenantId,
    },
  ]);

  if (oldValue && oldValue !== normalizedPath) {
    await safeDeletePublicFile(oldValue);
  }

  return normalizedPath;
}

export async function deleteLogo(
  type: LogoType,
  tenantId?: string | null,
): Promise<void> {
  const activeTenantId = await resolveActiveTenantId(tenantId);
  const settingKey = getSettingKey(type);
  const oldSetting = await SettingsRepository.findManyByKeys(
    [settingKey],
    activeTenantId,
  );
  const oldValue = oldSetting[0]?.value ?? null;

  await SettingsRepository.deleteManyByKeys([settingKey], activeTenantId);

  if (oldValue) {
    await safeDeletePublicFile(oldValue);
  }
}
