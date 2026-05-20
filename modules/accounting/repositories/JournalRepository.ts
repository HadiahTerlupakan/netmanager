import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  IJournalRepository,
  JournalCreateInput,
  JournalListFilter,
} from "../domain/ports/IJournalRepository";
import type {
  JournalEntry,
  JournalSource,
} from "../domain/entities/JournalEntry";
import { toJournalEntry } from "../mappers/journal.mapper";

export class JournalRepository implements IJournalRepository {
  async create(
    input: JournalCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<JournalEntry> {
    const client = tx ?? prisma;
    const row = await client.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        entryNumber: input.entryNumber,
        entryDate: input.entryDate,
        periodId: input.periodId,
        source: input.source,
        sourceRefType: input.sourceRefType ?? null,
        sourceRefId: input.sourceRefId ?? null,
        description: input.description,
        status: input.status ?? "POSTED",
        reversalOfId: input.reversalOfId ?? null,
        postedAt: new Date(),
        postedBy: input.postedBy ?? null,
        lines: {
          create: input.lines.map((line, idx) => ({
            coaId: line.coaId,
            side: line.side,
            amount: line.amount,
            description: line.description ?? null,
            lineOrder: line.lineOrder ?? idx + 1,
          })),
        },
      },
      include: { lines: true },
    });
    return toJournalEntry(row);
  }

  async findById(id: string): Promise<JournalEntry | null> {
    const row = await prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });
    return row ? toJournalEntry(row) : null;
  }

  async findBySource(
    tenantId: string,
    source: JournalSource,
    sourceRefId: string,
  ): Promise<JournalEntry | null> {
    const row = await prisma.journalEntry.findUnique({
      where: {
        tenantId_source_sourceRefId: { tenantId, source, sourceRefId },
      },
      include: { lines: true },
    });
    return row ? toJournalEntry(row) : null;
  }

  async list(
    filter: JournalListFilter,
  ): Promise<{ items: JournalEntry[]; total: number }> {
    const where: Prisma.JournalEntryWhereInput = {
      tenantId: filter.tenantId,
      ...(filter.from && { entryDate: { gte: filter.from } }),
      ...(filter.to && {
        entryDate: {
          ...((filter.from && { gte: filter.from }) || {}),
          lte: filter.to,
        },
      }),
      ...(filter.source && { source: filter.source }),
      ...(filter.status && { status: filter.status }),
      ...(filter.coaId && { lines: { some: { coaId: filter.coaId } } }),
    };

    const [items, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: { lines: true },
        orderBy: { entryDate: "desc" },
        skip: filter.skip ?? 0,
        take: filter.take ?? 50,
      }),
      prisma.journalEntry.count({ where }),
    ]);

    return { items: items.map(toJournalEntry), total };
  }

  async markReversed(
    id: string,
    _reversalEntryId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? prisma;
    await client.journalEntry.update({
      where: { id },
      data: { status: "REVERSED" },
    });
  }

  async countByMonth(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    return prisma.journalEntry.count({
      where: {
        tenantId,
        entryDate: { gte: startDate, lt: endDate },
      },
    });
  }
}
