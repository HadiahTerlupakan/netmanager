import { SettingsRepository } from "../repositories/SettingsRepository";
import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";

const PPP_CONNECTION_MODE_KEY = "PPP_CONNECTION_MODE";

export async function getPppConnectionMode(
  repository: ISettingsRepository = SettingsRepository,
) {
  const [setting] = await repository.findManyByKeys([PPP_CONNECTION_MODE_KEY]);
  return setting?.value ?? null;
}
