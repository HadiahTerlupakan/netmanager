import { logger } from "@/lib/logger";
import { MixRadiusConfigError } from "./mixradius-types";

export function isMixRadiusConfigError(message: string) {
  return (
    message.includes("konfigurasi") ||
    message.includes("valid") ||
    message.includes("Missing credentials")
  );
}

export function getCustomerConfigError(message: string, context: string) {
  logger.warn(`[MixRadius] Integration not available (${context}): ${message}`);
  return new MixRadiusConfigError(message);
}
