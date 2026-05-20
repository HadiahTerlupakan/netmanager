import { prisma } from "@/modules/database";
import type { Prisma } from "@prisma/client";
import type { OltCommandResultType } from "../domain/entities/olt-command-log.entity";

interface LogCommandInput {
  tenantId: string;
  oltId: string;
  onuId?: string;
  command: string;
  params: Prisma.InputJsonValue;
  result: OltCommandResultType;
  errorMsg?: string;
  executedBy: string;
}

export class OltCommandLogService {
  async log(input: LogCommandInput): Promise<void> {
    await prisma.oltCommandLog.create({
      data: {
        tenantId: input.tenantId,
        oltId: input.oltId,
        onuId: input.onuId ?? null,
        command: input.command,
        params: input.params,
        result: input.result,
        errorMsg: input.errorMsg ?? null,
        executedBy: input.executedBy,
      },
    });
  }

  async findByOlt(oltId: string, page: number, limit: number) {
    const [data, total] = await Promise.all([
      prisma.oltCommandLog.findMany({
        where: { oltId },
        orderBy: { executedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.oltCommandLog.count({ where: { oltId } }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
