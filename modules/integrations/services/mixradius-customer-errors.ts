import { logger } from "@/lib/logger";
import { MixRadiusConfigError } from "./mixradius-types";

export function isMixRadiusConfigError(errorOrMessage: unknown): boolean {
  if (errorOrMessage instanceof MixRadiusConfigError) return true;

  if (
    typeof errorOrMessage === "object" &&
    errorOrMessage !== null &&
    "name" in errorOrMessage &&
    (errorOrMessage as { name: string }).name === "MixRadiusConfigError"
  ) {
    return true;
  }

  if (typeof errorOrMessage === "string") {
    return (
      errorOrMessage.includes("konfigurasi") ||
      errorOrMessage.includes("Missing credentials")
    );
  }

  if (errorOrMessage instanceof Error) {
    return (
      errorOrMessage.message.includes("konfigurasi") ||
      errorOrMessage.message.includes("Missing credentials")
    );
  }

  return false;
}

export function getCustomerConfigError(message: string, context: string) {
  logger.warn(`[MixRadius] Integration not available (${context}): ${message}`);
  return new MixRadiusConfigError(message);
}
