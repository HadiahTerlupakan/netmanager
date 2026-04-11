const ALLOWED_FOLDERS = new Set([
  "general",
  "uploads",
  "user-profile",
  "invoices",
  "mitra-document",
  "work-orders",
  "izin",
]);

const PUBLIC_UPLOAD_PREFIXES = ["/uploads/employee/attendance/"];

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
