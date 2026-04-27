import { IntegrationFactory } from "../factories/IntegrationFactory";

/** Validate and normalize MixRadius base URL input. */
export function validateMixRadiusBaseUrl(baseUrl: string) {
  const normalizedBaseUrl =
    IntegrationFactory.normalizeMixRadiusBaseUrl(baseUrl);
  const validation = IntegrationFactory.validateUrl(normalizedBaseUrl);

  return {
    normalizedBaseUrl,
    validation,
  };
}
