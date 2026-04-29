import { logActivitySafe } from "@/lib/logger";
import type {
  CreateConfigurationRestoreEntityInput,
  CreateDeviceBackupEntityInput,
  DeviceBackupListFilters,
} from "../domain/entities/DeviceBackupEntity";
import type { IDeviceBackupRepository } from "../domain/ports/IDeviceBackupRepository";
import { DeviceBackupRepository } from "../repositories/DeviceBackupRepository";
import { createEmptyDeviceBackupList } from "../utils/createEmptyDeviceBackupList";

const MODEL_MISSING_ERROR_CODE = "P2021";

export type DeviceBackupServiceResult<T> =
  | { type: "success"; data: T; status?: number }
  | { type: "notFound"; message: string }
  | { type: "migrationPending"; message: string };

export class DeviceBackupService {
  constructor(
    private readonly repository: IDeviceBackupRepository = new DeviceBackupRepository(),
  ) {}

  /** List device backups with pagination and filters. */
  async listBackups(filters: DeviceBackupListFilters) {
    try {
      return await this.repository.findMany(filters);
    } catch (error: unknown) {
      if (this.isModelMissingError(error)) {
        return createEmptyDeviceBackupList(filters.page, filters.limit);
      }
      throw error;
    }
  }

  /** Get one device backup by id. */
  async getBackup(
    id: string,
  ): Promise<DeviceBackupServiceResult<{ data: unknown }>> {
    try {
      const backup = await this.repository.findById(id);
      if (!backup) {
        return { type: "notFound", message: "Backup" };
      }
      return { type: "success", data: { data: backup } };
    } catch (error: unknown) {
      if (this.isModelMissingError(error)) {
        return this.createMigrationPendingResult();
      }
      throw error;
    }
  }

  /** Create a device backup record. */
  async createBackup(input: CreateDeviceBackupEntityInput) {
    const backup = await this.repository.create(input);
    this.logCreate(input, backup.id);
    return { id: backup.id };
  }

  /** Delete a device backup record. */
  async deleteBackup(input: {
    id: string;
    userId: string;
  }): Promise<DeviceBackupServiceResult<{ message: string }>> {
    try {
      const backup = await this.repository.findById(input.id);
      if (!backup) {
        return { type: "notFound", message: "Backup" };
      }

      await this.repository.delete(input.id);
      this.logDelete(input.userId, input.id, backup.backupName);
      return { type: "success", data: { message: "Backup berhasil dihapus" } };
    } catch (error: unknown) {
      if (this.isModelMissingError(error)) {
        return this.createMigrationPendingResult();
      }
      throw error;
    }
  }

  /** Create a configuration restore from a backup. */
  async createRestore(
    input: CreateConfigurationRestoreEntityInput,
  ): Promise<DeviceBackupServiceResult<{ id: string }>> {
    try {
      const backup = await this.repository.findById(input.backupId);
      if (!backup) {
        return { type: "notFound", message: "Backup" };
      }

      const restore = await this.repository.createRestore(input);
      return { type: "success", data: { id: restore.id }, status: 201 };
    } catch (error: unknown) {
      if (this.isModelMissingError(error)) {
        return {
          type: "migrationPending",
          message:
            "Pemulihan konfigurasi akan tersedia setelah migrasi database",
        };
      }
      throw error;
    }
  }

  private logCreate(input: CreateDeviceBackupEntityInput, id: string) {
    logActivitySafe({
      action: "CREATE",
      subject: "Device Backup",
      userId: input.createdBy,
      details: {
        id,
        name: input.backupName,
        deviceId: input.deviceId,
      },
    });
  }

  private logDelete(userId: string, id: string, backupName: string) {
    logActivitySafe({
      action: "DELETE",
      subject: "Device Backup",
      userId,
      details: { id, name: backupName },
    });
  }

  private createMigrationPendingResult(): DeviceBackupServiceResult<never> {
    return {
      type: "migrationPending",
      message: "Device backups will be available after database migration",
    };
  }

  private isModelMissingError(error: unknown) {
    return (
      error instanceof Error &&
      (error as unknown as Record<string, unknown>).code ===
        MODEL_MISSING_ERROR_CODE
    );
  }
}
