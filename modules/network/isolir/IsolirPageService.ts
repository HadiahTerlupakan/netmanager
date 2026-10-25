import type { IsolirPage } from "@prisma/client";
import { logger } from "@/lib/logger";
import path from "path";
import {
  deleteUploadedFile,
  isImageFile,
  saveFile,
} from "@/lib/utils/image-upload";
import { resolveIsolirContent } from "./isolir-content";
import type { IsolirPageInput } from "./isolir-page.types";
import { renderIsolirPage, type IsolirRenderResult } from "./isolir-render";
import { IsolirPageRepository } from "./IsolirPageRepository";

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_LOGO_EXTENSION = ".png";

export type IsolirPageView = {
  page: IsolirPage | null;
  preview: IsolirRenderResult;
};

/** Kolom yang boleh diisi lewat PUT; logo punya jalur unggah sendiri. */
export type IsolirPageUpdate = Omit<IsolirPageInput, "logoUrl">;

export class IsolirLogoError extends Error {}

type PushToRouters = (tenantId: string) => Promise<unknown>;

function extensionOf(file: File): string {
  const match = /\.[a-z0-9]{1,5}$/i.exec(file.name);
  return match ? match[0].toLowerCase() : DEFAULT_LOGO_EXTENSION;
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
      if (!isImageFile(file)) {
        throw new IsolirLogoError("File harus berupa gambar");
      }
      if (file.size > MAX_LOGO_SIZE_BYTES) {
        throw new IsolirLogoError("Ukuran file maksimal 5MB");
      }
      const previous = await IsolirPageRepository.findByTenant(tenantId);
      const stored = await saveFile(
        file,
        path.join(process.cwd(), "public", "uploads", "logos"),
        `isolir-${tenantId}-${Date.now()}${extensionOf(file)}`,
        "logos",
      );
      const page = await IsolirPageRepository.upsertForTenant(tenantId, {
        logoUrl: stored,
      });
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
