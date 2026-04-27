import type { ISalaryRepository } from "../domain/ports/ISalaryRepository";
import { SalaryRepository } from "../repositories/SalaryRepository";
import { calculateSalaryTotals } from "../utils/salary-totals-calculator";

export class SalaryAuditService {
  private readonly salaryRepository: ISalaryRepository;

  constructor(salaryRepository: ISalaryRepository = new SalaryRepository()) {
    this.salaryRepository = salaryRepository;
  }

  /** Submit salary for audit review. */
  async submitForAudit(salaryId: string): Promise<void> {
    const salary = await this.getSalaryOrThrow(salaryId);
    const canSubmit =
      salary.status === "CALCULATED" || salary.status === "REVISED";

    if (!canSubmit) {
      throw new Error(
        `Tidak dapat submit untuk audit. Status saat ini: ${salary.status}`,
      );
    }
  }

  /** Mark salary as audited. */
  async audit(
    salaryId: string,
    auditorId: string,
    notes?: string,
  ): Promise<void> {
    const salary = await this.getSalaryOrThrow(salaryId);
    const canAudit =
      salary.status === "CALCULATED" || salary.status === "REVISED";

    if (!canAudit) {
      throw new Error(`Tidak dapat audit. Status saat ini: ${salary.status}`);
    }

    await this.salaryRepository.updateStatus(
      salaryId,
      "AUDITED",
      auditorId,
      notes,
    );
  }

  /** Request revision for a salary record. */
  async requestRevision(
    salaryId: string,
    auditorId: string,
    reason: string,
  ): Promise<void> {
    const salary = await this.getSalaryOrThrow(salaryId);
    const canRevise =
      salary.status === "CALCULATED" || salary.status === "AUDITED";

    if (!canRevise) {
      throw new Error(
        `Tidak dapat request revision. Status saat ini: ${salary.status}`,
      );
    }

    await this.salaryRepository.updateStatus(salaryId, "REVISED", auditorId);
    await this.salaryRepository.addRevision(
      salaryId,
      "status",
      salary.status,
      "REVISED",
      reason,
      auditorId,
    );
  }

  /** Add manual adjustment during revision. */
  async addManualAdjustment(
    salaryId: string,
    name: string,
    type: "EARNING" | "DEDUCTION",
    amount: number,
    notes: string,
    addedById: string,
  ): Promise<void> {
    const salary = await this.getSalaryOrThrow(salaryId);

    if (salary.status !== "REVISED") {
      throw new Error(
        `Tidak dapat menambah komponen manual. Status harus REVISED (klik "Minta Revisi" terlebih dahulu). Saat ini: ${salary.status}`,
      );
    }

    await this.salaryRepository.addDetail(salaryId, {
      name,
      type,
      amount: Number(amount),
      notes: `${notes} (Manual Adjustment)`,
    });
    await this.salaryRepository.addRevision(
      salaryId,
      `add:${type.toLowerCase()}`,
      null,
      `${name}: ${amount}`,
      notes,
      addedById,
    );

    const updatedSalary = await this.salaryRepository.findById(salaryId);
    if (!updatedSalary) {
      return;
    }

    const totals = calculateSalaryTotals(updatedSalary.details);
    await this.salaryRepository.update(salaryId, {
      ...totals,
      status: "REVISED",
    });
  }

  /** Record detail revision and refresh salary totals. */
  async reviseDetail(
    salaryId: string,
    detailName: string,
    newAmount: number,
    reason: string,
    revisedById: string,
  ): Promise<void> {
    const salary = await this.getSalaryOrThrow(salaryId);
    const detail = salary.details.find((item) => item.name === detailName);

    if (!detail) {
      throw new Error(`Detail "${detailName}" tidak ditemukan`);
    }

    await this.salaryRepository.addRevision(
      salaryId,
      `detail:${detailName}`,
      String(detail.amount),
      String(newAmount),
      reason,
      revisedById,
    );

    const revisedDetails = salary.details.map((item) => ({
      type: item.type,
      amount: item.name === detailName ? newAmount : item.amount,
    }));
    const totals = calculateSalaryTotals(revisedDetails);
    await this.salaryRepository.update(salaryId, {
      ...totals,
      status: "REVISED",
    });
  }

  /** Approve audited salary. */
  async approve(salaryId: string, approverId: string): Promise<void> {
    const salary = await this.getSalaryOrThrow(salaryId);

    if (salary.status !== "AUDITED") {
      throw new Error(
        `Tidak dapat approve. Status saat ini: ${salary.status}. Harus AUDITED.`,
      );
    }

    await this.salaryRepository.updateStatus(salaryId, "APPROVED", approverId);
  }

  /** Mark approved salary as paid. */
  async markAsPaid(salaryId: string): Promise<void> {
    const salary = await this.getSalaryOrThrow(salaryId);

    if (salary.status !== "APPROVED") {
      throw new Error(
        `Tidak dapat mark as paid. Status saat ini: ${salary.status}. Harus APPROVED.`,
      );
    }

    await this.salaryRepository.updateStatus(salaryId, "PAID");
  }

  /** Bulk approve audited salaries for one period. */
  async bulkApprove(
    month: number,
    year: number,
    approverId: string,
  ): Promise<number> {
    const { salaries } = await this.salaryRepository.findAll({
      month,
      year,
      status: "AUDITED",
    });

    let count = 0;
    for (const salary of salaries) {
      await this.salaryRepository.updateStatus(
        salary.id,
        "APPROVED",
        approverId,
      );
      count += 1;
    }

    return count;
  }

  /** Bulk mark approved salaries as paid for one period. */
  async bulkMarkAsPaid(month: number, year: number): Promise<number> {
    const { salaries } = await this.salaryRepository.findAll({
      month,
      year,
      status: "APPROVED",
    });

    let count = 0;
    for (const salary of salaries) {
      await this.salaryRepository.updateStatus(salary.id, "PAID");
      count += 1;
    }

    return count;
  }

  /** Load salary or throw not found error. */
  private async getSalaryOrThrow(salaryId: string) {
    const salary = await this.salaryRepository.findById(salaryId);

    if (!salary) {
      throw new Error("Salary record tidak ditemukan");
    }

    return salary;
  }
}
