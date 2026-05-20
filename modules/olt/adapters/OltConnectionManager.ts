import { logger } from "@/lib/logger";
import type { ServiceResult } from "../domain/ports/IOltAdapter";

const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 5000;

export class OltConnectionManager {
  async withRetry<T>(
    operation: () => Promise<ServiceResult<T>>,
    context: string,
  ): Promise<ServiceResult<T>> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const result = await operation();
      if (result.success) return result;

      lastError = result.error;
      if (!this.isRetryable(result.code)) break;

      if (attempt < MAX_RETRIES) {
        const delay = Math.min(
          BACKOFF_BASE_MS * Math.pow(2, attempt),
          BACKOFF_MAX_MS,
        );
        logger.warn(
          `[OltConnection] Retry ${attempt + 1}/${MAX_RETRIES} for ${context}, waiting ${delay}ms`,
        );
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError ?? "Unknown error",
      code: "RETRY_EXHAUSTED",
    };
  }

  private isRetryable(code?: string): boolean {
    return code === "TIMEOUT" || code === "CONNECTION_LOST";
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
