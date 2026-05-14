import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";
import { SettingsRepository } from "../repositories/SettingsRepository";

const SETTINGS_KEY = "mixradius_fees";
const MIXRADIUS_FEE_DESCRIPTION =
  "Konfigurasi Fee Transaksi MixRadius (Payment Gateway)";

export class MixRadiusFeeSettingsService {
  constructor(
    private readonly settingsRepository: ISettingsRepository = new SettingsRepository(),
  ) {}

  async getConfig(): Promise<Record<string, unknown>> {
    const setting = await this.settingsRepository.findByKey(SETTINGS_KEY);
    return setting?.value ? JSON.parse(setting.value) : {};
  }

  async saveConfig(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const result = await this.settingsRepository.upsertByKey({
      key: SETTINGS_KEY,
      value: JSON.stringify(payload),
      description: MIXRADIUS_FEE_DESCRIPTION,
    });
    return result.value ? JSON.parse(result.value) : {};
  }
}
