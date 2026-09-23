import { AppError } from "@/lib/errors";
import type { IProspekRepository } from "../domain/ports/IProspekRepository";
import type {
  ISalesRepository,
  SalesRingkas,
} from "../domain/ports/ISalesRepository";
import { ProspekRepository } from "../repositories/ProspekRepository";
import { SalesRepository } from "../repositories/SalesRepository";

/**
 * Cakupan tenant pemanggil saat membaca prospek acuan.
 *
 * Union bertanda, bukan `string | null`: nilai `undefined` yang lolos karena
 * `strictNullChecks: false` tidak boleh terbaca sebagai "tanpa batas".
 */
export type AksesTenantPresurvei =
  | { jenis: "tenant"; tenantId: string }
  | { jenis: "lintas-tenant" };

/**
 * Sumber daftar sales untuk layar presurvei — dropdown filter, layar target,
 * dan pemilih pemilik prospek.
 *
 * Ada karena endpoint sales yang sudah ada menuntut `users:read` atau
 * `sales:read`, permission yang belum tentu dipegang pemakai layar presurvei.
 */
export class SalesPresurveiService {
  constructor(
    private readonly repository: ISalesRepository = new SalesRepository(),
    private readonly prospekRepository: IProspekRepository = new ProspekRepository(),
  ) {}

  /** Sales aktif di tenant pemanggil. */
  async daftarAktif(tenantId: string): Promise<SalesRingkas[]> {
    return this.repository.daftarAktif(tenantId);
  }

  /**
   * Sales aktif di tenant PROSPEK — calon pemilik yang akan diterima
   * `ProspekService.ubah`. Tenant diturunkan di server dari barisnya, tidak
   * pernah dari klien.
   *
   * Prospek tenant lain (atau tak bertenant) dijawab 404 yang sama dengan
   * "tidak ada" bagi pemanggil bercakupan satu tenant. Ekstensi tenant sudah
   * menyaring pembacaan mereka; pemeriksaan di sini lapis kedua yang tidak
   * bergantung padanya. Bagi super admin, prospek tanpa tenant dijawab 422:
   * tidak ada sales yang bisa lolos validasi penugasan untuk baris itu, dan
   * daftar kosong tidak akan bisa dibedakan dari "tenant tanpa sales".
   */
  async daftarAktifUntukProspek(
    prospekId: string,
    akses: AksesTenantPresurvei,
  ): Promise<SalesRingkas[]> {
    const prospek = await this.prospekRepository.findById(prospekId);
    const isTerjangkau =
      Boolean(prospek) &&
      (akses.jenis === "lintas-tenant" || prospek.tenantId === akses.tenantId);
    if (!isTerjangkau) {
      throw new AppError("Prospek tidak ditemukan", 404, "NOT_FOUND");
    }
    if (!prospek.tenantId) {
      throw new AppError(
        "Prospek ini tidak bertenant; pemilik tidak bisa ditugaskan",
        422,
        "PROSPEK_TANPA_TENANT",
      );
    }
    return this.repository.daftarAktif(prospek.tenantId);
  }
}
