import {
  AcsSettingsRepository,
  normalizeAcsVendorPayload,
  type AcsVendorInput,
  isUniqueConstraintError,
} from '../repositories/AcsSettingsRepository'

export async function listAcsVendors() {
  return AcsSettingsRepository.findAllVendors()
}

export async function createAcsVendor(payload: AcsVendorInput) {
  try {
    return await AcsSettingsRepository.createVendor(normalizeAcsVendorPayload(payload))
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error('VENDOR_NAME_EXISTS')
    }
    throw error
  }
}

export async function updateAcsVendor(id: string, payload: AcsVendorInput) {
  try {
    return await AcsSettingsRepository.updateVendor(id, normalizeAcsVendorPayload(payload))
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error('VENDOR_NAME_EXISTS')
    }
    throw error
  }
}

export async function deleteAcsVendor(id: string) {
  await AcsSettingsRepository.deleteVendor(id)
}
