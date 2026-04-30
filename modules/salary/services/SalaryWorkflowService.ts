import type {
  SalaryEntity,
  SalaryStatus,
} from "../domain/entities/SalaryEntity";
import type { ISalaryRepository } from "../domain/ports/ISalaryRepository";
import { SalaryRepository } from "../repositories/SalaryRepository";
import type { ServiceResult } from "./SalaryService.helpers";

/** Mengelola workflow status salary seperti audit, approval, paid, delete, dan update. */
export class SalaryWorkflowService {
  constructor(
    private readonly repository: ISalaryRepository = new SalaryRepository(),
  ) {}

  /** Audit salary yang sudah dihitung. */
  async auditSalary(input: StatusTransitionInput) {
    return this.updateStatus({
      ...input,
      expectedStatus: "CALCULATED",
      nextStatus: "AUDITED",
      invalidStatusError: "Gaji harus dihitung sebelum diaudit",
    });
  }

  /** Approve salary yang sudah diaudit. */
  async approveSalary(input: StatusTransitionInput) {
    return this.updateStatus({
      ...input,
      expectedStatus: "AUDITED",
      nextStatus: "APPROVED",
      invalidStatusError: "Gaji harus diaudit sebelum disetujui",
    });
  }

  /** Tandai salary approved sebagai sudah dibayar. */
  async markAsPaid(input: StatusTransitionInput) {
    return this.updateStatus({
      ...input,
      expectedStatus: "APPROVED",
      nextStatus: "PAID",
      invalidStatusError: "Gaji harus disetujui sebelum ditandai dibayar",
    });
  }

  /** Hapus salary draft. */
  async deleteDraft(id: string): Promise<ServiceResult<SalaryEntity>> {
    const existing = await this.repository.findById(id);
    const validation = validateExistingSalary(existing);
    if (!validation.success) return validation;

    if (existing.status !== "DRAFT") {
      return {
        success: false,
        error: "Hanya gaji draft yang dapat dihapus",
        code: "INVALID_STATUS",
      };
    }

    await this.repository.delete(id);
    return { success: true, data: existing };
  }

  /** Validasi salary yang bisa dihitung ulang. */
  async getRecalculatableSalary(id: string) {
    const existing = await this.repository.findById(id);
    const validation = validateExistingSalary(existing);
    if (!validation.success) return validation;

    if (!canRecalculate(existing.status)) {
      return {
        success: false,
        error:
          "Hanya gaji draft atau yang sudah dihitung yang dapat dihitung ulang",
        code: "INVALID_STATUS",
      };
    }

    await this.repository.clearDetails(id);
    return { success: true, data: existing };
  }

  /** Update metadata salary setelah validasi status. */
  async updateCalculatedSalary(input: {
    id: string;
    data: { auditNotes?: string };
  }): Promise<ServiceResult<SalaryEntity>> {
    const existing = await this.repository.findById(input.id);
    const validation = validateExistingSalary(existing);
    if (!validation.success) return validation;

    if (!canUpdateMetadata(existing.status)) {
      return {
        success: false,
        error: `Tidak dapat mengubah gaji dengan status: ${existing.status}`,
        code: "INVALID_STATUS",
      };
    }

    const salary = await this.repository.update(input.id, {
      ...(input.data.auditNotes !== undefined && {
        auditNotes: input.data.auditNotes,
      }),
    });
    return { success: true, data: salary };
  }

  private async updateStatus(
    input: StatusTransitionInput & StatusTransitionRule,
  ): Promise<ServiceResult<SalaryEntity>> {
    const existing = await this.repository.findById(input.id);
    const validation = validateExistingSalary(existing);
    if (!validation.success) return validation;

    if (existing.status !== input.expectedStatus) {
      return {
        success: false,
        error: input.invalidStatusError,
        code: "INVALID_STATUS",
      };
    }

    const salary = await this.repository.updateStatus(
      input.id,
      input.nextStatus,
      input.actorId,
      input.notes,
    );
    return { success: true, data: salary };
  }
}

type StatusTransitionInput = {
  id: string;
  actorId: string;
  notes?: string;
};

type StatusTransitionRule = {
  expectedStatus: SalaryStatus;
  nextStatus: SalaryStatus;
  invalidStatusError: string;
};

function validateExistingSalary(
  salary: SalaryEntity | null,
): ServiceResult<SalaryEntity> {
  if (!salary) {
    return {
      success: false,
      error: "Gaji tidak ditemukan",
      code: "NOT_FOUND",
    };
  }

  return { success: true, data: salary };
}

function canRecalculate(status: string) {
  return ["DRAFT", "CALCULATED"].includes(status);
}

function canUpdateMetadata(status: string) {
  return ["CALCULATED", "REVISED"].includes(status);
}
