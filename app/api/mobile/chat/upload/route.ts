import { createHandler, apiSuccess, apiError, ErrorCodes } from "@/lib/api";
import { logger } from "@/lib/logger";
import { buildTenantUploadDir } from "@/lib/upload/upload-policy";
import { resolveAbsoluteUploadUrl } from "@/lib/upload/trusted-upload-url";
import { convertAndSaveImage } from "@/lib/utils/image-upload";

/** Ukuran gambar chat terbesar yang diterima. */
const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;
/** Kelonggaran untuk pembungkus multipart di atas ukuran gambarnya. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const PESAN_TERLALU_BESAR =
  "Gambar terlalu besar. Maksimal 5MB; kecilkan atau potong gambarnya dulu.";

/** Galat sharp saat isi berkas bukan gambar yang bisa dibaca. */
const POLA_GAMBAR_TAK_TERBACA =
  /unsupported image format|input buffer|corrupt/i;

function tolak(pesan: string, status = 400) {
  return apiError(pesan, ErrorCodes.VALIDATION_ERROR, { status });
}

/**
 * Unggah gambar chat. Ukuran dicek dari header sebelum body dibaca supaya
 * kiriman raksasa tidak dimuat ke memori, lalu gambar di-encode ulang:
 * nama, ekstensi, dan tipe dari klien tidak pernah dipakai apa adanya.
 */
export const POST = createHandler(
  { auth: true, permissions: ["m_chat:create"] },
  async (req, ctx) => {
    const userId = ctx.session!.user.id;
    const tenantId = ctx.session!.user.tenantId;
    if (!tenantId) {
      return tolak(
        "Akun Anda belum terhubung ke kantor mana pun. Hubungi admin.",
      );
    }

    const declaredLength = Number(req.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_CHAT_IMAGE_BYTES + MULTIPART_OVERHEAD_BYTES) {
      return tolak(PESAN_TERLALU_BESAR, 413);
    }

    const formData = await req.formData().catch((): null => null);
    const file = formData?.get("image");
    if (!(file instanceof File)) {
      return tolak("Gambar belum dipilih. Pilih gambar dulu, lalu kirim lagi.");
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return tolak(
        "Jenis file ini tidak bisa dikirim. Kirim foto berformat JPG, PNG, GIF, atau WEBP.",
      );
    }
    if (file.size > MAX_CHAT_IMAGE_BYTES) {
      return tolak(PESAN_TERLALU_BESAR, 413);
    }

    const uploadDir = buildTenantUploadDir("public/uploads/chat", tenantId);
    try {
      const url = await convertAndSaveImage(
        file,
        uploadDir,
        `${userId}-${Date.now()}`,
        "chat",
      );
      return apiSuccess({ imageUrl: resolveAbsoluteUploadUrl(req, url) });
    } catch (error) {
      const pesan = error instanceof Error ? error.message : "";
      if (!POLA_GAMBAR_TAK_TERBACA.test(pesan)) throw error;
      logger.warn("[Chat] Gambar chat tidak terbaca", {
        type: file.type,
        size: file.size,
        pesan,
      });
      return tolak(
        "Gambar ini rusak atau tidak bisa dibaca. Ambil foto baru, lalu kirim lagi.",
      );
    }
  },
);
