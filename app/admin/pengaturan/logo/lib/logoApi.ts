import type { LogoType } from "./constants";
import type { LogoSettings, LogoUploadResponse } from "./types";
import { LOGO_API, LOGO_MESSAGES } from "./constants";

function unwrapApiData<T>(payload: T | { data?: T }): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: T }).data;
    if (nested !== undefined) {
      return nested;
    }
  }
  return payload as T;
}

/**
 * Fetch current logo settings from API.
 */
export async function fetchLogoSettings(): Promise<LogoSettings> {
  const response = await fetch(LOGO_API.SETTINGS);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || LOGO_MESSAGES.ERROR.LOAD_FAILED);
  }

  const payload = await response.json();
  return unwrapApiData<LogoSettings>(payload);
}

/**
 * Upload logo file to API.
 */
export async function uploadLogoFile(
  type: LogoType,
  file: File,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const response = await fetch(LOGO_API.SETTINGS, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || LOGO_MESSAGES.ERROR.UPLOAD_FAILED);
  }

  const payload = await response.json();
  const data = unwrapApiData<LogoUploadResponse>(payload);
  return data.logoPath;
}

/**
 * Delete logo from API.
 */
export async function deleteLogoFile(type: LogoType): Promise<void> {
  const response = await fetch(LOGO_API.SETTINGS, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || LOGO_MESSAGES.ERROR.DELETE_FAILED);
  }
}
