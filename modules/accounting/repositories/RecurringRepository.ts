import { prisma } from "@/lib/prisma";
import type {
  IRecurringRepository,
  RecurringCreateInput,
} from "../domain/ports/IRecurringRepository";
import type { RecurringJournalTemplate } from "../domain/entities/RecurringJournalTemplate";

function toRecurringTemplate(row: {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  frequency: string;
  dayOfMonth: number;
  startDate: Date;
  endDate: Date | null;
  templateLines: unknown;
  isActive: boolean;
  lastGeneratedAt: Date | null;
}): RecurringJournalTemplate {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    frequency: row.frequency as RecurringJournalTemplate["frequency"],
    dayOfMonth: row.dayOfMonth,
    startDate: row.startDate,
    endDate: row.endDate,
    templateLines:
      row.templateLines as RecurringJournalTemplate["templateLines"],
    isActive: row.isActive,
    lastGeneratedAt: row.lastGeneratedAt,
  };
}

export class RecurringRepository implements IRecurringRepository {
  async create(input: RecurringCreateInput): Promise<RecurringJournalTemplate> {
    const row = await prisma.recurringJournalTemplate.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        description: input.description ?? null,
        frequency: input.frequency,
        dayOfMonth: input.dayOfMonth,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        templateLines: input.templateLines as unknown as object[],
        isActive: true,
      },
    });
    return toRecurringTemplate(row);
  }

  async update(
    id: string,
    input: Partial<RecurringCreateInput> & { isActive?: boolean },
  ): Promise<RecurringJournalTemplate> {
    const row = await prisma.recurringJournalTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.frequency !== undefined && { frequency: input.frequency }),
        ...(input.dayOfMonth !== undefined && { dayOfMonth: input.dayOfMonth }),
        ...(input.startDate !== undefined && { startDate: input.startDate }),
        ...(input.endDate !== undefined && { endDate: input.endDate }),
        ...(input.templateLines !== undefined && {
          templateLines: input.templateLines as unknown as object[],
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
    return toRecurringTemplate(row);
  }

  async findById(id: string): Promise<RecurringJournalTemplate | null> {
    const row = await prisma.recurringJournalTemplate.findUnique({
      where: { id },
    });
    return row ? toRecurringTemplate(row) : null;
  }

  async list(tenantId: string): Promise<RecurringJournalTemplate[]> {
    const rows = await prisma.recurringJournalTemplate.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
    return rows.map(toRecurringTemplate);
  }

  async findDueToday(today: Date): Promise<RecurringJournalTemplate[]> {
    const dayOfMonth = today.getDate();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const rows = await prisma.recurringJournalTemplate.findMany({
      where: {
        isActive: true,
        dayOfMonth,
        startDate: { lte: today },
        AND: [
          { OR: [{ endDate: null }, { endDate: { gte: today } }] },
          {
            OR: [
              { lastGeneratedAt: null },
              { lastGeneratedAt: { lt: startOfMonth } },
            ],
          },
        ],
      },
    });
    return rows.map(toRecurringTemplate);
  }

  async markGenerated(id: string, at: Date): Promise<void> {
    await prisma.recurringJournalTemplate.update({
      where: { id },
      data: { lastGeneratedAt: at },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.recurringJournalTemplate.delete({ where: { id } });
  }
}
