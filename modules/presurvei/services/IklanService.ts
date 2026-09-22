import { AppError } from "@/lib/errors";
import type { IklanEntity } from "../domain/entities/Iklan";
import type {
  CreateIklanInput,
  IIklanRepository,
  IklanListFilters,
  UpdateIklanInput,
} from "../domain/ports/IIklanRepository";
import { IklanRepository } from "../repositories/IklanRepository";

/**
 * Orkestrasi iklan presurvei.
 *
 * Menjaga dua hal yang tidak bisa dijaga skema: kode kampanye tidak boleh
 * bertabrakan, dan rentang tanggalnya harus masuk akal.
 */
export class IklanService {
  constructor(
    private readonly repository: IIklanRepository = new IklanRepository(),
  ) {}

  /** Ambil satu halaman iklan sesuai filter. */
  async daftar(
    filters: IklanListFilters,
  ): Promise<{ items: IklanEntity[]; total: number }> {
    return this.repository.findMany(filters);
  }

  /** Ambil satu iklan, melempar 404 bila tidak ada. */
  async detail(id: string): Promise<IklanEntity> {
    const iklan = await this.repository.findById(id);
    if (!iklan) {
      throw new AppError("Iklan tidak ditemukan", 404, "NOT_FOUND");
    }
    return iklan;
  }

  /** Simpan iklan baru, menolak kode yang sudah dipakai. */
  async buat(input: CreateIklanInput): Promise<IklanEntity> {
    const bentrok = await this.repository.findByKode(input.kode);
    if (bentrok) {
      throw new AppError(
        `Kode kampanye "${input.kode}" sudah dipakai iklan lain`,
        409,
        "DUPLIKAT",
      );
    }

    this.pastikanRentangTanggalMasukAkal(
      input.tanggalMulai,
      input.tanggalSelesai,
    );

    return this.repository.create(input);
  }

  /** Perbarui iklan; kode kampanye tidak bisa diubah. */
  async ubah(id: string, input: UpdateIklanInput): Promise<IklanEntity> {
    const iklan = await this.detail(id);

    this.pastikanRentangTanggalMasukAkal(
      input.tanggalMulai ?? iklan.tanggalMulai,
      input.tanggalSelesai,
    );

    return this.repository.update(id, input);
  }

  private pastikanRentangTanggalMasukAkal(
    mulai: Date,
    selesai: Date | null | undefined,
  ): void {
    if (!selesai) return;
    if (selesai.getTime() >= mulai.getTime()) return;

    throw new AppError(
      "Tanggal selesai iklan tidak boleh mendahului tanggal mulai",
      400,
      "VALIDATION_ERROR",
    );
  }
}
