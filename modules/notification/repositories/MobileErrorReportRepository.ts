import { randomUUID } from "crypto";

import { LogType } from "@prisma/client";

import { prisma } from "@/modules/database";
import type {
  IMobileErrorReportRepository,
  MobileErrorReportLogInput,
} from "../domain/ports/IMobileErrorReportRepository";

/**
 * Repository untuk menyimpan laporan error mobile ke SystemLog.
 *
 * Mengikuti pola `resolveActor` di `lib/logger.ts`: aktor non-user (mitra,
 * pelanggan) ditulis via `actorType` + `actorId` dengan `userId: null`
 * supaya tidak mengenai FK `SystemLog_userId_fkey`.
 */
export class MobileErrorReportRepository implements IMobileErrorReportRepository {
  async createSystemLog(input: MobileErrorReportLogInput) {
    const safeUserId = await resolveSafeUserId(input.userId);
    if (input.userId && safeUserId === null) {
      // User tidak ada di tabel User — skip DB log seperti logger utama.
      return;
    }

    await prisma.systemLog.create({
      data: {
        id: randomUUID(),
        type: LogType.SYSTEM,
        action: input.action,
        subject: input.subject,
        details: input.details,
        userId: safeUserId,
        actorType: input.actorType,
        actorId: input.actorId,
        tenantId: input.tenantId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }
}

/**
 * Pastikan `userId` punya record di tabel `User` sebelum dipakai sebagai FK.
 * Null/undefined langsung lolos (anonymous report).
 */
async function resolveSafeUserId(
  userId: string | null,
): Promise<string | null> {
  if (!userId) {
    return null;
  }

  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  return userExists ? userId : null;
}
