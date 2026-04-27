import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";
import { SettingsRepository } from "../repositories/SettingsRepository";

const MIXRADIUS_DASHBOARD_MODE = "MIKROTIK_API";
const PPP_CONNECTION_MODE_KEY = "PPP_CONNECTION_MODE";

export class MixRadiusPageService {
  constructor(
    private readonly settingsRepository: ISettingsRepository = new SettingsRepository(),
  ) {}

  /** Check whether the page should redirect to dashboard. */
  async shouldRedirectToDashboard() {
    const setting = await this.settingsRepository.findByKey(
      PPP_CONNECTION_MODE_KEY,
    );

    return setting?.value === MIXRADIUS_DASHBOARD_MODE;
  }
}
