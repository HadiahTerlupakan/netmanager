import { AcsSettingsRepository } from "../repositories/AcsSettingsRepository";
import type {
  AcsWifiSecurityInput,
  IAcsSettingsRepository,
} from "../domain/ports/IAcsSettingsRepository";
import { normalizeAcsWifiSecurityPayload } from "../validators/acsSettingsValidator";

const defaultAcsSettingsRepository: IAcsSettingsRepository =
  AcsSettingsRepository;

/** Lists ACS WiFi security configurations for tenant scope. */
export async function listAcsWifiSecurityConfigs(
  tenantId?: string | null,
  repository: IAcsSettingsRepository = defaultAcsSettingsRepository,
) {
  return repository.findWifiSecurityByTenant(tenantId ?? null);
}

/** Upserts ACS WiFi security by tenant and product class. */
export async function upsertAcsWifiSecurity(
  payload: AcsWifiSecurityInput,
  tenantId?: string | null,
  repository: IAcsSettingsRepository = defaultAcsSettingsRepository,
) {
  return repository.upsertWifiSecurityByTenantAndProductClass(
    tenantId ?? null,
    normalizeAcsWifiSecurityPayload(payload),
  );
}

/** Updates ACS WiFi security by id. */
export async function updateAcsWifiSecurity(
  id: string,
  payload: AcsWifiSecurityInput,
  repository: IAcsSettingsRepository = defaultAcsSettingsRepository,
) {
  return repository.updateWifiSecurity(
    id,
    normalizeAcsWifiSecurityPayload(payload),
  );
}

/** Deletes ACS WiFi security by id. */
export async function deleteAcsWifiSecurity(
  id: string,
  repository: IAcsSettingsRepository = defaultAcsSettingsRepository,
) {
  await repository.deleteWifiSecurity(id);
}
