import type { IJournalRepository } from "../../domain/ports/IJournalRepository";

export class JournalNumberGenerator {
  constructor(private readonly journalRepo: IJournalRepository) {}

  async generate(tenantId: string, entryDate: Date): Promise<string> {
    const year = entryDate.getFullYear();
    const month = entryDate.getMonth() + 1;
    const count = await this.journalRepo.countByMonth(tenantId, year, month);
    const seq = String(count + 1).padStart(4, "0");
    const mm = String(month).padStart(2, "0");
    return `JV-${year}-${mm}-${seq}`;
  }
}
