import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";
import { SettingsRepository } from "../repositories/SettingsRepository";

export class AttendanceSettingsService {
  private readonly settingsRepository: ISettingsRepository;

  constructor(
    settingsRepository: ISettingsRepository = new SettingsRepository(),
  ) {
    this.settingsRepository = settingsRepository;
  }

  /** Find a single attendance-related setting. */
  async findByKey(key: string, tenantId?: string) {
    return this.settingsRepository.findByKey(key, tenantId);
  }

  /** Find multiple attendance-related settings. */
  async findManyByKeys(keys: string[]) {
    return this.settingsRepository.findManyByKeys(keys);
  }
}
