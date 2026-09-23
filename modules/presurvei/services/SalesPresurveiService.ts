import type {
  ISalesRepository,
  SalesRingkas,
} from "../domain/ports/ISalesRepository";
import { SalesRepository } from "../repositories/SalesRepository";

/**
 * Sumber daftar sales untuk layar presurvei — dropdown filter dan layar target.
 *
 * Ada karena endpoint sales yang sudah ada menuntut `users:read` atau
 * `sales:read`, permission yang belum tentu dipegang pemakai layar presurvei.
 */
export class SalesPresurveiService {
  constructor(
    private readonly repository: ISalesRepository = new SalesRepository(),
  ) {}

  /** Sales aktif di tenant pemanggil. */
  async daftarAktif(tenantId: string): Promise<SalesRingkas[]> {
    return this.repository.daftarAktif(tenantId);
  }
}
