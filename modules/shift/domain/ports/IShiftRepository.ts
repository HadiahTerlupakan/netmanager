import type { CreateShiftDTO, UpdateShiftDTO } from "../../dto/ShiftDTO";
import type { ShiftEntity } from "../entities/ShiftEntity";

export interface IShiftRepository {
  /** Mengambil semua shift berdasarkan tenant. */
  findAll(tenantId: string, includeInactive?: boolean): Promise<ShiftEntity[]>;

  /** Mengambil shift berdasarkan id. */
  findById(tenantId: string, id: string): Promise<ShiftEntity | null>;

  /** Mengambil shift berdasarkan kode. */
  findByCode(tenantId: string, code: string): Promise<ShiftEntity | null>;

  /** Membuat shift baru. */
  create(tenantId: string, data: CreateShiftDTO): Promise<ShiftEntity>;

  /** Memperbarui data shift. */
  update(
    tenantId: string,
    id: string,
    data: UpdateShiftDTO,
  ): Promise<ShiftEntity>;

  /** Melakukan soft delete pada shift. */
  delete(tenantId: string, id: string): Promise<void>;

  /** Menghapus shift secara permanen. */
  hardDelete(tenantId: string, id: string): Promise<void>;

  /** Menghitung jumlah user yang memakai shift. */
  getUserCount(tenantId: string, shiftId: string): Promise<number>;
}
