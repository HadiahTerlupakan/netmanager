import type {
  AcsVendorInput,
  AcsWifiSecurityInput,
} from "../domain/ports/IAcsSettingsRepository";

const DEFAULT_VENDOR_PRIORITY = 10;
const DEFAULT_VENDOR_ENABLED = true;

/** Normalizes ACS vendor payload before persistence. */
export function normalizeAcsVendorPayload(
  payload: AcsVendorInput,
): AcsVendorInput {
  return {
    name: payload.name.trim(),
    manufacturerPatterns: payload.manufacturerPatterns.trim(),
    productPatterns: payload.productPatterns.trim(),
    parameterPrefix: payload.parameterPrefix?.trim() || null,
    priority: payload.priority ?? DEFAULT_VENDOR_PRIORITY,
    enabled: payload.enabled ?? DEFAULT_VENDOR_ENABLED,
    description: payload.description?.trim() || null,
  };
}

/** Normalizes ACS WiFi security payload before persistence. */
export function normalizeAcsWifiSecurityPayload(
  payload: AcsWifiSecurityInput,
): AcsWifiSecurityInput {
  return {
    productClass: payload.productClass.trim(),
    parameterPath: payload.parameterPath.trim(),
    wpaTypes: payload.wpaTypes?.trim() || null,
    encryptTypes: payload.encryptTypes?.trim() || null,
  };
}
