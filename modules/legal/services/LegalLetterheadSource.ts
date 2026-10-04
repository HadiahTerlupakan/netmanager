import { logger } from "@/lib/logger";
import { getGeneralSettings, getTrimmedLogo } from "@/modules/settings";
import type { Letterhead } from "./LegalTemplateRenderer";

/** Penyedia kop surat; dipisah supaya pembuatan dokumen bisa diuji tanpa pengaturan. */
export interface LetterheadSource {
  getLetterhead(): Promise<Letterhead>;
}

/** Kop surat dari Pengaturan Umum tenant (nama, alamat, telepon, email) dan logo invoice. */
export class SettingsLetterheadSource implements LetterheadSource {
  async getLetterhead(): Promise<Letterhead> {
    const [settings, logo] = await Promise.all([getGeneralSettings(), this.loadLogo()]);

    return {
      companyName: settings.perusahaan,
      address: settings.alamat,
      phone: settings.nomorHp,
      email: settings.email,
      logo,
    };
  }

  /** Logo yang gagal diambil tidak boleh menggagalkan dokumen; kop tetap tercetak. */
  private async loadLogo(): Promise<Letterhead["logo"]> {
    try {
      const logo = await getTrimmedLogo("invoice");
      return logo ? { bytes: logo.data, contentType: logo.contentType } : null;
    } catch (error) {
      logger.warn("[LegalLetterhead] Logo gagal dimuat, kop dicetak tanpa logo:", error);
      return null;
    }
  }
}
