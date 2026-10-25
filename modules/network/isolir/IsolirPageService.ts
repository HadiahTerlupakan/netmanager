import type { IsolirPage } from "@prisma/client";
import { logger } from "@/lib/logger";
import path from "path";
import sharp from "sharp";
import { deleteUploadedFile, saveFile } from "@/lib/utils/image-upload";
import { resolveIsolirContent } from "./isolir-content";
import type { IsolirPageInput } from "./isolir-page.types";
import { renderIsolirPage, type IsolirRenderResult } from "./isolir-render";
import { IsolirPageRepository } from "./IsolirPageRepository";

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
// Batas piksel mencegah PNG kecil yang mendeklarasikan dimensi raksasa
// menghabiskan memori saat didecode; logo hanya perlu ukuran kecil.
const MAX_LOGO_SIDE_PX = 2048;
const STORED_LOGO_SIDE_PX = 512;
const SHARP_LIMITS = {
  limitInputPixels: MAX_LOGO_SIDE_PX * MAX_LOGO_SIDE_PX,
  animated: false,
};
const ALLOWED_LOGO_FORMATS = ["png", "jpeg", "webp", "gif"];

export type IsolirPageView = {
  page: IsolirPage | null;
  preview: IsolirRenderResult;
};

/** Kolom yang boleh diisi lewat PUT; logo punya jalur unggah sendiri. */
export type IsolirPageUpdate = Omit<IsolirPageInput, "logoUrl">;

export class IsolirLogoError extends Error {}

type PushToRouters = (tenantId: string) => Promise<unknown>;

// Tipe dan ekstensi dari klien tidak dipercaya: berkas HTML/SVG di origin
// aplikasi bisa menjalankan skrip. Hanya hasil decode sharp yang disimpan.
async function toWebp(file: File): Promise<File> {
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const { format, width, height } = await sharp(
      input,
      SHARP_LIMITS,
    ).metadata();
    if (!format || !ALLOWED_LOGO_FORMATS.includes(format)) {
      throw new IsolirLogoError("Logo harus berupa PNG, JPG, WebP, atau GIF");
    }
    if ((width ?? 0) > MAX_LOGO_SIDE_PX || (height ?? 0) > MAX_LOGO_SIDE_PX) {
      throw new IsolirLogoError(`Dimensi logo maksimal ${MAX_LOGO_SIDE_PX}px`);
    }
    const output = await sharp(input, SHARP_LIMITS)
      .resize({
        width: STORED_LOGO_SIDE_PX,
        height: STORED_LOGO_SIDE_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp()
      .toBuffer();
    return new File([new Uint8Array(output)], "logo.webp", {
      type: "image/webp",
    });
  } catch (error) {
    if (error instanceof IsolirLogoError) throw error;
    throw new IsolirLogoError("File harus berupa gambar yang valid");
  }
}

// Berkas lokal dirujuk "/uploads/...", sedangkan R2 memberi URL penuh.
async function deleteStoredLogo(stored: string | null): Promise<void> {
  if (!stored) {
    return;
  }
  try {
    await deleteUploadedFile(new URL(stored, "http://localhost").toString());
  } catch (error) {
    logger.warn("[isolir] Logo lama tidak bisa dihapus:", error);
  }
}

/**
 * `pushToRouters` diinjeksi supaya layanan ini bisa dites tanpa router;
 * kegagalannya tidak boleh menggagalkan penyimpanan di halaman pengaturan.
 */
export function createIsolirPageService(pushToRouters: PushToRouters) {
  // Sengaja tanpa await: pengiriman ke router lambat dan hasilnya dipantau
  // lewat status sinkronisasi, bukan lewat respons HTTP.
  function pushInBackground(tenantId: string): void {
    void Promise.resolve()
      .then(() => pushToRouters(tenantId))
      .catch((error) => {
        logger.error("[isolir] Pengiriman halaman isolir gagal:", error);
      });
  }

  async function renderForTenant(
    tenantId: string,
  ): Promise<IsolirRenderResult> {
    return renderIsolirPage(await resolveIsolirContent(tenantId));
  }

  async function viewFor(page: IsolirPage | null, tenantId: string) {
    return { page, preview: await renderForTenant(tenantId) };
  }

  return {
    renderForTenant,

    async get(tenantId: string): Promise<IsolirPageView> {
      const page = await IsolirPageRepository.findByTenant(tenantId);
      return viewFor(page, tenantId);
    },

    async update(
      tenantId: string,
      input: Partial<IsolirPageUpdate>,
    ): Promise<IsolirPageView> {
      // PUT mengganti seluruh isi: kolom yang tidak dikirim kembali ke default.
      const page = await IsolirPageRepository.upsertForTenant(tenantId, {
        ispName: input.ispName ?? null,
        title: input.title ?? null,
        message: input.message ?? null,
        payments: input.payments ?? [],
        whatsappNumber: input.whatsappNumber ?? null,
        whatsappText: input.whatsappText ?? null,
        linkLabel: input.linkLabel ?? null,
        linkUrl: input.linkUrl ?? null,
        contactText: input.contactText ?? null,
        primaryColor: input.primaryColor ?? null,
      });
      pushInBackground(tenantId);
      return viewFor(page, tenantId);
    },

    async setLogo(tenantId: string, file: File): Promise<IsolirPage> {
      if (file.size > MAX_LOGO_SIZE_BYTES) {
        throw new IsolirLogoError("Ukuran file maksimal 5MB");
      }
      const webp = await toWebp(file);
      const previous = await IsolirPageRepository.findByTenant(tenantId);
      const stored = await saveFile(
        webp,
        path.join(process.cwd(), "public", "uploads", "logos"),
        `isolir-${tenantId}-${Date.now()}.webp`,
        "logos",
      );
      let page: IsolirPage;
      try {
        page = await IsolirPageRepository.upsertForTenant(tenantId, {
          logoUrl: stored,
        });
      } catch (error) {
        await deleteStoredLogo(stored);
        throw error;
      }
      if (previous?.logoUrl && previous.logoUrl !== stored) {
        await deleteStoredLogo(previous.logoUrl);
      }
      pushInBackground(tenantId);
      return page;
    },

    async removeLogo(tenantId: string): Promise<void> {
      const previous = await IsolirPageRepository.findByTenant(tenantId);
      if (!previous?.logoUrl) {
        return;
      }
      await IsolirPageRepository.upsertForTenant(tenantId, { logoUrl: null });
      await deleteStoredLogo(previous.logoUrl);
      pushInBackground(tenantId);
    },
  };
}

export type IsolirPageService = ReturnType<typeof createIsolirPageService>;

// Pengiriman sungguhan ke router dipasang oleh pekerjaan pengiriman halaman;
// sampai itu ada, penyimpanan tetap berjalan tanpa mendorong apa pun.
const pushNothing: PushToRouters = async () => undefined;

let instance: IsolirPageService | undefined;

export function getIsolirPageService(): IsolirPageService {
  instance ??= createIsolirPageService(pushNothing);
  return instance;
}
