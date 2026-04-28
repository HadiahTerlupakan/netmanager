import { MitraRepository } from "../repositories/MitraRepository";
import type { MitraIdCardEntity } from "../domain/entities/MitraEntity";
import type { IMitraRepository } from "../domain/ports/IMitraRepository";
import type { MitraIdCardDTO } from "../dto/MitraIdCardDTO";

const DEFAULT_TITLE_NAME = "Mitra";

export class MitraIdCardService {
  constructor(
    private readonly repository: IMitraRepository = new MitraRepository(),
  ) {}

  /** Ambil data ID card mitra yang siap dikirim ke client. */
  async getIdCardData(id: string) {
    const mitra = await this.repository.findIdCardById(id);
    return mitra ? this.toDTO(mitra) : null;
  }

  /** Ambil judul metadata ID card mitra. */
  async getIdCardTitle(id: string) {
    const mitra = await this.repository.findIdCardTitleById(id);
    return `ID Card - ${mitra?.name || DEFAULT_TITLE_NAME}`;
  }

  private toDTO(mitra: MitraIdCardEntity): MitraIdCardDTO {
    return {
      id: mitra.id,
      name: mitra.name,
      mitraType: mitra.mitraType as MitraIdCardDTO["mitraType"],
      nik: mitra.nik,
      fotoDiri: mitra.fotoDiri,
      phone: mitra.phone,
      createdAt: mitra.createdAt.toISOString(),
      sites: mitra.site,
    };
  }
}

export const mitraIdCardService = new MitraIdCardService();
