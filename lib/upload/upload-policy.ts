const ALLOWED_FOLDERS = new Set([
  "general",
  "uploads",
  "user-profile",
  "invoices",
  "mitra-document",
  "work-orders",
  "izin",
  "landing-logo",
]);

const PUBLIC_UPLOAD_PREFIXES = [
  "/uploads/employee/attendance/",
  "/uploads/logos/",
];

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES_BY_FOLDER: Record<string, Set<string>> = {
  invoices: new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  "mitra-document": new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  "work-orders": new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  izin: new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  default: new Set(["image/jpeg", "image/png", "image/webp"]),
};

interface FolderResult {
  ok: boolean;
  folder?: string;
  error?: string;
}

interface FileValidationInput {
  folder: string;
  mimeType: string;
  size: number;
  fileName: string;
}

interface FileValidationResult {
  ok: boolean;
  safeBaseName?: string;
  extension?: string;
  error?: string;
}

export function sanitizeUploadFolder(
  rawFolder: string | null | undefined,
): FolderResult {
  const folder = (rawFolder ?? "general").trim().toLowerCase();

  if (!ALLOWED_FOLDERS.has(folder)) {
    return { ok: false, error: "Folder upload tidak diizinkan" };
  }

  return { ok: true, folder };
}

export function isPublicUploadPath(
  pathname: string | null | undefined,
): boolean {
  const normalizedPath = (pathname ?? "").trim();

  if (!normalizedPath.startsWith("/uploads/")) {
    return false;
  }

  return PUBLIC_UPLOAD_PREFIXES.some((prefix) =>
    normalizedPath.startsWith(prefix),
  );
}

export function validateUploadFile(
  input: FileValidationInput,
): FileValidationResult {
  const fileName = input.fileName.trim();
  const mimeType = input.mimeType.trim().toLowerCase();

  if (!fileName) {
    return { ok: false, error: "Nama file tidak valid" };
  }

  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, error: "Ukuran file tidak valid" };
  }

  if (input.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Ukuran file maksimal 5MB" };
  }

  const lastDot = fileName.lastIndexOf(".");
  const extension =
    lastDot > -1 ? fileName.slice(lastDot + 1).toLowerCase() : "";

  if (!extension) {
    return { ok: false, error: "Ekstensi file wajib ada" };
  }

  const allowedMimeTypes =
    ALLOWED_MIME_TYPES_BY_FOLDER[input.folder] ??
    ALLOWED_MIME_TYPES_BY_FOLDER.default;
  if (!allowedMimeTypes.has(mimeType)) {
    return { ok: false, error: "Tipe file tidak diizinkan" };
  }

  const safeBaseName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);

  if (!safeBaseName) {
    return { ok: false, error: "Nama file tidak valid" };
  }

  return {
    ok: true,
    safeBaseName,
    extension,
  };
}

export function getUploadMaxBytes(): number {
  return MAX_UPLOAD_BYTES;
}

/**
 * Validasi tenantId untuk dipakai sebagai segmen path upload. Why: tanpa
 * sanitasi, value dari sesi yang ter-tamper bisa berisi `..` atau separator
 * path → path traversal. UUID Prisma cukup ketat, tetapi guardrail ini wajib
 * tetap ada untuk mencegah regresi.
 */
export function sanitizeTenantUploadSegment(
  tenantId: string | null | undefined,
): string | null {
  if (!tenantId || typeof tenantId !== "string") {
    return null;
  }
  const safe = tenantId.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe || safe.length === 0 || safe.length > 64) {
    return null;
  }
  return safe;
}

/**
 * Bangun direktori upload yang ter-namespace per tenant. Contoh:
 *   buildTenantUploadDir("public/uploads/profiles", tenantId)
 *     → "public/uploads/tenants/{tenantId}/profiles"
 *
 * Why: path lama `public/uploads/{folder}` membuat file lintas tenant berbagi
 * namespace yang sama — collision dan data leak via static URL. Namespace
 * eksplisit `tenants/{tenantId}/` memastikan isolasi di filesystem.
 */
export function buildTenantUploadDir(
  baseDir: string,
  tenantId: string | null | undefined,
): string {
  const safeTenant = sanitizeTenantUploadSegment(tenantId);
  if (!safeTenant) {
    throw new Error("Tenant ID tidak valid untuk upload path");
  }

  const trimmed = baseDir.replace(/\/+$/, "");
  const PUBLIC_UPLOADS_PREFIX = "public/uploads";

  if (trimmed === PUBLIC_UPLOADS_PREFIX) {
    return `${PUBLIC_UPLOADS_PREFIX}/tenants/${safeTenant}`;
  }

  if (trimmed.startsWith(`${PUBLIC_UPLOADS_PREFIX}/`)) {
    const suffix = trimmed.slice(PUBLIC_UPLOADS_PREFIX.length + 1);
    return `${PUBLIC_UPLOADS_PREFIX}/tenants/${safeTenant}/${suffix}`;
  }

  return `${trimmed}/tenants/${safeTenant}`;
}
