import { API_SETTINGS_CONSTANTS, API_SETTINGS_MESSAGES } from "./constants";

export interface R2ValidationInput {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validate R2 connection fields before testing.
 */
export function validateR2Connection(
  input: R2ValidationInput,
): ValidationResult {
  if (
    !input.accountId.trim() ||
    !input.accessKeyId.trim() ||
    !input.bucketName.trim()
  ) {
    return {
      valid: false,
      error: API_SETTINGS_MESSAGES.ERROR.R2_FIELDS_REQUIRED,
    };
  }

  if (input.secretAccessKey === API_SETTINGS_CONSTANTS.SECRET_PLACEHOLDER) {
    return {
      valid: false,
      error: API_SETTINGS_MESSAGES.ERROR.R2_SECRET_PLACEHOLDER,
    };
  }

  if (!input.secretAccessKey.trim()) {
    return {
      valid: false,
      error: API_SETTINGS_MESSAGES.ERROR.R2_SECRET_REQUIRED,
    };
  }

  return { valid: true };
}
