import type { DeviceBackupListResultEntity } from "../domain/entities/DeviceBackupEntity";

/** Buat hasil daftar backup kosong saat tabel belum tersedia. */
export function createEmptyDeviceBackupList(
  page: number,
  limit: number,
): DeviceBackupListResultEntity {
  return {
    data: [],
    pagination: {
      page,
      limit,
      total: 0,
      totalPages: 0,
    },
    message: "Device backups will be available after database migration",
  };
}
