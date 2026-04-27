import { AcsSettingsRepository } from "../repositories/AcsSettingsRepository";
import type {
  AcsVendorInput,
  IAcsSettingsRepository,
} from "../domain/ports/IAcsSettingsRepository";
import { normalizeAcsVendorPayload } from "../validators/acsSettingsValidator";
import { isUniqueConstraintError } from "../validators/settingsValidator";

const defaultAcsSettingsRepository: IAcsSettingsRepository =
  AcsSettingsRepository;

/** Lists all ACS vendor configurations. */
export async function listAcsVendors(
  repository: IAcsSettingsRepository = defaultAcsSettingsRepository,
) {
  return repository.findAllVendors();
}

/** Creates a new ACS vendor configuration. */
export async function createAcsVendor(
  payload: AcsVendorInput,
  repository: IAcsSettingsRepository = defaultAcsSettingsRepository,
) {
  try {
    return await repository.createVendor(normalizeAcsVendorPayload(payload));
  } catch (error) {
    handleVendorConflict(error);
    throw error;
  }
}

/** Updates an ACS vendor configuration. */
export async function updateAcsVendor(
  id: string,
  payload: AcsVendorInput,
  repository: IAcsSettingsRepository = defaultAcsSettingsRepository,
) {
  try {
    return await repository.updateVendor(
      id,
      normalizeAcsVendorPayload(payload),
    );
  } catch (error) {
    handleVendorConflict(error);
    throw error;
  }
}

/** Deletes an ACS vendor configuration. */
export async function deleteAcsVendor(
  id: string,
  repository: IAcsSettingsRepository = defaultAcsSettingsRepository,
) {
  await repository.deleteVendor(id);
}

function handleVendorConflict(error: unknown): void {
  if (isUniqueConstraintError(error)) {
    throw new Error("VENDOR_NAME_EXISTS");
  }
}
