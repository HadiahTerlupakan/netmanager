import { randomUUID } from "crypto";

import { LogType } from "@prisma/client";

import { prisma } from "@/modules/database";
import type {
  IMobileErrorReportRepository,
  MobileErrorReportLogInput,
} from "../domain/ports/IMobileErrorReportRepository";

export class MobileErrorReportRepository implements IMobileErrorReportRepository {
  async createSystemLog(input: MobileErrorReportLogInput) {
    await prisma.systemLog.create({
      data: {
        id: randomUUID(),
        type: LogType.SYSTEM,
        action: input.action,
        subject: input.subject,
        details: input.details,
        userId: input.userId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }
}
