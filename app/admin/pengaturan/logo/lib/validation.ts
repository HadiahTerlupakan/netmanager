import { LOGO_CONSTANTS, LOGO_MESSAGES } from "./constants";

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validate if file is an image with correct type and size.
 */
export function validateLogoFile(file: File): ValidationResult {
  if (!file.type.startsWith("image/")) {
    return { valid: false, error: LOGO_MESSAGES.ERROR.INVALID_FILE_TYPE };
  }

  if (file.size > LOGO_CONSTANTS.MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: LOGO_MESSAGES.ERROR.FILE_TOO_LARGE };
  }

  return { valid: true };
}

/**
 * Read file as data URL for preview.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
