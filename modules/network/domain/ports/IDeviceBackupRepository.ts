import type {
  ConfigurationRestoreEntity,
  CreateConfigurationRestoreEntityInput,
  CreateDeviceBackupEntityInput,
  DeviceBackupEntity,
  DeviceBackupListFilters,
  DeviceBackupListResultEntity,
} from "../entities/DeviceBackupEntity";

export interface IDeviceBackupRepository {
  /** List device backups with pagination and filters. */
  findMany(
    filters: DeviceBackupListFilters,
  ): Promise<DeviceBackupListResultEntity>;

  /** Find a device backup by id. */
  findById(id: string): Promise<DeviceBackupEntity | null>;

  /** Create a device backup record. */
  create(input: CreateDeviceBackupEntityInput): Promise<DeviceBackupEntity>;

  /** Delete a device backup by id. */
  delete(id: string): Promise<void>;

  /** Create a configuration restore record. */
  createRestore(
    input: CreateConfigurationRestoreEntityInput,
  ): Promise<ConfigurationRestoreEntity>;
}
