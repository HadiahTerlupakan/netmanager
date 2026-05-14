import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";
import { SettingsRepository } from "../repositories/SettingsRepository";

export class MixRadiusPageService {
  constructor(
    private readonly settingsRepository: ISettingsRepository = new SettingsRepository(),
  ) {}

  async shouldRedirectToDashboard() {
    const setting = await this.settingsRepository.findByKey(
      "PPP_CONNECTION_MODE",
    );
    return setting?.value === "MIKROTIK_API";
  }
}
