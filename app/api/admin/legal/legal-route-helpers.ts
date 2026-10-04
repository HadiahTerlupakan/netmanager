import { AppError } from "@/lib/errors";
import { permissionListAllows } from "@/lib/rbac";
import type { LegalAccess, LegalUpload } from "@/modules/legal";

/**
 * Helper bersama rute legal: hak membuka kategori rahasia dan pembacaan
 * formulir multipart (berkas + field `payload` JSON).
 */

/** Akses kategori rahasia dihitung dari izin sesi, lewat aturan RBAC terpusat. */
export function legalAccessFrom(ctx: {
  permissions: string[];
  session?: { user: { isSuperAdmin?: boolean } } | null;
}): LegalAccess {
  return {
    canViewConfidential: permissionListAllows(
      { permissions: ctx.permissions, isSuperAdmin: ctx.session?.user.isSuperAdmin },
      "legal_rahasia:read",
    ),
  };
}

/** Berkas dari form; null bila tidak diunggah dan tidak wajib. */
export async function readLegalUpload(
  formData: FormData,
  isRequired: boolean,
): Promise<LegalUpload | null> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    if (isRequired) throw new AppError("Berkas dokumen wajib diunggah", 400, "VALIDATION_ERROR");
    return null;
  }

  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    fileName: file.name,
    contentType: file.type,
  };
}

/** Field `payload` berupa JSON; JSON rusak dijawab 400, bukan 500. */
export function readLegalPayload(formData: FormData): unknown {
  const raw = formData.get("payload");
  if (typeof raw !== "string") {
    throw new AppError("Data dokumen tidak lengkap", 400, "VALIDATION_ERROR");
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError("Data dokumen tidak valid", 400, "VALIDATION_ERROR");
  }
}
