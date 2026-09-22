import { AppError } from "@/lib/errors";
import type { ProspekEntity } from "../domain/entities/Prospek";
import { isTransisiStatusSah } from "../domain/prospek-rules";
import type {
  CreateProspekInput,
  IProspekRepository,
  ProspekListFilters,
  UpdateProspekInput,
} from "../domain/ports/IProspekRepository";
import { ProspekRepository } from "../repositories/ProspekRepository";

/**
 * Orkestrasi prospek presurvei.
 *
 * Menjaga agar perpindahan status hanya terjadi lewat jalur yang diizinkan
 * aturan funnel di domain.
 */
export class ProspekService {
  constructor(
    private readonly repository: IProspekRepository = new ProspekRepository(),
  ) {}

  /** Ambil satu halaman prospek sesuai filter. */
  async daftar(
    filters: ProspekListFilters,
  ): Promise<{ items: ProspekEntity[]; total: number }> {
    return this.repository.findMany(filters);
  }

  /** Ambil satu prospek, melempar 404 bila tidak ada. */
  async detail(id: string): Promise<ProspekEntity> {
    const prospek = await this.repository.findById(id);
    if (!prospek) {
      throw new AppError("Prospek tidak ditemukan", 404, "NOT_FOUND");
    }
    return prospek;
  }

  /** Simpan prospek baru. */
  async buat(input: CreateProspekInput): Promise<ProspekEntity> {
    return this.repository.create(input);
  }

  /** Perbarui prospek, menolak perpindahan status yang tidak sah. */
  async ubah(id: string, input: UpdateProspekInput): Promise<ProspekEntity> {
    const prospek = await this.detail(id);

    if (input.status && input.status !== prospek.status) {
      if (!isTransisiStatusSah(prospek.status, input.status)) {
        throw new AppError(
          `Prospek berstatus ${prospek.status} tidak bisa langsung dipindah ke ${input.status}`,
          409,
          "INVALID_STATE",
        );
      }
    }

    return this.repository.update(id, input);
  }
}
