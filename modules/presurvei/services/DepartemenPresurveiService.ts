import type {
  DepartemenRingkas,
  IDepartemenRepository,
} from "../domain/ports/IDepartemenRepository";
import { DepartemenRepository } from "../repositories/DepartemenRepository";

/**
 * Sumber daftar departemen untuk filter "Departemen" layar kegiatan.
 *
 * Ada karena `GET /api/admin/departments` menuntut `department:read` atau
 * `users:create` (kecuali `reminderOnly`, yang hanya memuat departemen
 * target pengingat) — izin yang belum tentu dipegang pemakai layar presurvei.
 */
export class DepartemenPresurveiService {
  constructor(
    private readonly repository: IDepartemenRepository = new DepartemenRepository(),
  ) {}

  /** Departemen di tenant pemanggil. */
  async daftar(tenantId: string): Promise<DepartemenRingkas[]> {
    return this.repository.daftar(tenantId);
  }
}
