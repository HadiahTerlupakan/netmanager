import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * Audit Logging untuk Authorization
 */

interface LogAuthAttemptParams {
  userId: string | null;
  url: string;
  action: string;
  granted: boolean;
  details?: Record<string, unknown>;
}

export async function logAuthAttempt({
  userId,
  url,
  action,
  granted,
  details,
}: LogAuthAttemptParams): Promise<void> {
  try {
    await prisma.systemLog.create({
      data: {
        id: crypto.randomUUID(),
        type: "AUTH",
        action,
        subject: url.substring(0, 500),
        ...(userId ? { userId } : {}),
        details: JSON.stringify({ granted, ...details }),
      },
    });
  } catch (error) {
    logger.error("[AUTH] Failed to log auth attempt:", error);
  }
}
