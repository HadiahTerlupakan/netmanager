import { sanitizeInput } from "@/lib/utils/sanitize";

export function getOptionalNumber(value: unknown) {
  return value !== undefined && value !== null && value !== ""
    ? Number(value)
    : undefined;
}

export function getSanitizedOptionalText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  return sanitizeInput(value);
}

export function getOptionalIdentifier(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  return value;
}

export function getProfilePoolMode(value: unknown) {
  return typeof value === "string" && value ? value : "MIKROTIK";
}

export function getProfileStatus(value: unknown) {
  return typeof value === "string" && value ? value : "AKTIF";
}
