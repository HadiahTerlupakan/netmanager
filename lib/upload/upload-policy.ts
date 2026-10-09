import { posix } from "path";

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

  // Prefix publik dibandingkan terhadap jalur tanpa segmen tenant supaya aturan
  // yang sama berlaku untuk file lama (`/uploads/employee/attendance/…`) maupun
  // yang sudah ber-namespace (`/uploads/tenants/<id>/employee/attendance/…`).
  const tanpaTenant = lepasSegmenTenant(normalizedPath);

  return PUBLIC_UPLOAD_PREFIXES.some((prefix) =>
    tanpaTenant.startsWith(prefix),
  );
}

/** `/uploads/tenants/<id>/x` → `/uploads/x`; jalur lain dikembalikan apa adanya. */
function lepasSegmenTenant(pathname: string): string {
  const cocok = /^\/uploads\/tenants\/([^/]+)\/(.*)$/.exec(pathname);
  return cocok ? `/uploads/${cocok[2]}` : pathname;
}

/**
 * Tenant pemilik sebuah jalur upload, atau null bila jalurnya tidak
 * ber-namespace tenant.
 *
 * Dipakai penjaga penyajian `/uploads/` untuk menolak pembaca dari tenant lain.
 * File lama tidak punya segmen ini dan karena itu tidak bisa dikaitkan ke
 * tenant mana pun — penanganannya ada di pemanggil.
 */
export function tenantJalurUpload(
  pathname: string | null | undefined,
): string | null {
  const cocok = /^\/uploads\/tenants\/([^/]+)\//.exec((pathname ?? "").trim());
  return cocok ? cocok[1] : null;
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

/**
 * Tenant pemilik sebuah direktori upload hasil `buildTenantUploadDir`, atau
 * null bila direktorinya tidak ber-namespace.
 *
 * Dipakai saat menyusun kunci R2 supaya tata letaknya sama dengan penyimpanan
 * lokal — satu bentuk jalur untuk dua backend, dan tenant selalu ada di segmen
 * yang sama.
 */
export function tenantDariDirektoriUpload(
  uploadDir: string | null | undefined,
): string | null {
  const normal = (uploadDir ?? "").replace(/\\/g, "/");
  const cocok = /(?:^|\/)uploads\/tenants\/([^/]+)(?:\/|$)/.exec(normal);
  return cocok ? cocok[1] : null;
}

/**
 * Bentuk kanonik sebuah jalur `/uploads/` — hasil decode sekali lalu normalisasi
 * — atau null bila jalurnya tidak sah.
 *
 * Keputusan izin dan pemilihan berkas wajib memakai bentuk yang sama persis.
 * Sebelum ini keduanya berbeda: pemeriksaan tenant membaca jalur apa adanya,
 * sementara berkasnya akhirnya disajikan handler statis Next yang men-decode
 * `%2f`. Permintaan ke
 * `/uploads/tenants/<tenant-sendiri>/..%2f<tenant-lain>/rahasia.webp` karena itu
 * lolos pemeriksaan sebagai milik sendiri lalu menyajikan berkas tenant lain
 * secara utuh.
 */
export function kanonikJalurUpload(
  pathname: string | null | undefined,
): string | null {
  const mentah = (pathname ?? "").trim();
  if (!mentah.startsWith("/uploads/")) return null;

  let terdekode: string;
  try {
    terdekode = decodeURIComponent(mentah);
  } catch {
    return null;
  }

  // Backslash adalah pemisah direktori di Windows dan NUL memotong nama berkas
  // di lapisan C; keduanya tidak pernah sah dalam URL upload.
  if (terdekode.includes("\\") || terdekode.includes("\0")) return null;

  const ternormalisasi = posix.normalize(terdekode);
  if (!ternormalisasi.startsWith("/uploads/")) return null;

  return ternormalisasi;
}
