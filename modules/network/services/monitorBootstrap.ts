import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_RETRY_DELAY_MS = 5000;

type WaitForDatabaseReadyOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForDatabaseReady(
  options: WaitForDatabaseReadyOptions = {},
) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info(
        `[MonitorBootstrap] Database ready on attempt ${attempt}/${maxAttempts}`,
      );
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : "Unknown database error";
      logger.warn(
        `[MonitorBootstrap] Database not ready on attempt ${attempt}/${maxAttempts}: ${message}`,
      );
      await delay(retryDelayMs);
    }
  }
}
