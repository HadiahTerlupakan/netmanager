import type { IMitraRepository } from "../domain/ports/IMitraRepository";
import { getMitraRepository } from "../repositories/MitraRepository";

export class MitraLookupService {
  constructor(
    private readonly repository: IMitraRepository = getMitraRepository(),
  ) {}

  /** Menghapus push token mitra yang tidak valid. */
  async clearPushTokens(tokens: string[]) {
    return this.repository.clearPushTokens(tokens);
  }

  /** Mengambil daftar mitra berdasarkan token push. */
  async findManyWithPushToken(tokens: string[]) {
    return this.repository.findManyWithPushToken(tokens);
  }

  /** Mengambil push token mitra berdasarkan id. */
  async findPushTokenById(id: string) {
    return this.repository.findPushTokenById(id);
  }

  /** Mengambil daftar mitra bertoken push dari kumpulan id. */
  async findManyWithPushTokenByIds(ids: string[]) {
    return this.repository.findManyWithPushTokenByIds(ids);
  }

  /** Mengambil seluruh id mitra pada site tertentu. */
  async findIdsBySite(siteId: string) {
    return this.repository.findIdsBySite(siteId);
  }

  /** Mengambil ringkasan mitra untuk kebutuhan canvasing. */
  async findCanvasingSummary(id: string) {
    return this.repository.findCanvasingSummary(id);
  }
}

let instance: MitraLookupService | null = null;

export function getMitraLookupService(): MitraLookupService {
  if (!instance) {
    instance = new MitraLookupService();
  }

  return instance;
}
