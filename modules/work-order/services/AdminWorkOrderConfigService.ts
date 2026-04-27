import { ErrorCodes } from "@/lib/api";

import {
  AdminWorkOrderConfigRepository,
  type EscalationListQuery,
  type SlaListQuery,
  type TemplateListQuery,
} from "../repositories/AdminWorkOrderConfigRepository";

const TEMPLATE_IN_USE_MESSAGE =
  "Tidak dapat menghapus template yang sedang digunakan oleh work order";
const SLA_IN_USE_MESSAGE =
  "Tidak dapat menghapus aturan SLA yang sedang digunakan oleh work order";

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

interface PaginationPayload<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Service route tipis untuk konfigurasi admin work order. */
export class AdminWorkOrderConfigService {
  private readonly repository = new AdminWorkOrderConfigRepository();

  /** Ambil daftar template work order. */
  async getTemplates(
    query: TemplateListQuery,
  ): Promise<ServiceResult<PaginationPayload<unknown>>> {
    return this.getPaginatedResult(query, (input) =>
      this.repository.findTemplates(input),
    );
  }

  /** Buat template work order baru. */
  async createTemplate(input: Record<string, unknown>, userId: string) {
    return this.runAction(
      () => this.repository.createTemplate(input, userId),
      "Gagal membuat template work order",
    );
  }

  /** Ambil detail template work order. */
  async getTemplateById(id: string) {
    return this.getSingleResult(
      () => this.repository.findTemplateById(id),
      "Template Work Order",
    );
  }

  /** Perbarui template work order. */
  async updateTemplate(id: string, input: Record<string, unknown>) {
    return this.updateSingleResult(
      () => this.repository.findTemplateById(id),
      () => this.repository.updateTemplate(id, input),
      "Template Work Order",
      "Gagal memperbarui template work order",
    );
  }

  /** Hapus template work order. */
  async deleteTemplate(id: string): Promise<ServiceResult<null>> {
    const template = await this.repository.findTemplateById(id);

    if (!template) {
      return this.createNotFoundResult("Template Work Order");
    }

    const count = await this.repository.countWorkOrdersByTemplateId(id);
    if (count > 0) {
      return this.createValidationResult(TEMPLATE_IN_USE_MESSAGE);
    }

    await this.repository.deleteTemplate(id);
    return { success: true, data: null };
  }

  /** Ambil daftar escalation rule. */
  async getEscalations(
    query: EscalationListQuery,
  ): Promise<ServiceResult<PaginationPayload<unknown>>> {
    return this.getPaginatedResult(query, (input) =>
      this.repository.findEscalations(input),
    );
  }

  /** Buat escalation rule baru. */
  async createEscalation(input: Record<string, unknown>, userId: string) {
    return this.runAction(
      () => this.repository.createEscalation(input, userId),
      "Gagal membuat aturan eskalasi",
    );
  }

  /** Ambil detail escalation rule. */
  async getEscalationById(id: string) {
    return this.getSingleResult(
      () => this.repository.findEscalationById(id),
      "Aturan Eskalasi",
    );
  }

  /** Perbarui escalation rule. */
  async updateEscalation(id: string, input: Record<string, unknown>) {
    return this.updateSingleResult(
      () => this.repository.findEscalationById(id),
      () => this.repository.updateEscalation(id, input),
      "Aturan Eskalasi",
      "Gagal memperbarui aturan eskalasi",
    );
  }

  /** Hapus escalation rule. */
  async deleteEscalation(id: string): Promise<ServiceResult<null>> {
    const escalation = await this.repository.findEscalationById(id);

    if (!escalation) {
      return this.createNotFoundResult("Aturan Eskalasi");
    }

    await this.repository.deleteEscalation(id);
    return { success: true, data: null };
  }

  /** Ambil daftar aturan SLA. */
  async getSlas(
    query: SlaListQuery,
  ): Promise<ServiceResult<PaginationPayload<unknown>>> {
    return this.getPaginatedResult(query, async (input) => {
      const result = await this.repository.findSlas(input);
      return {
        data: result.data.map((item) => this.mapSlaResponse(item)),
        total: result.total,
      };
    });
  }

  /** Buat aturan SLA baru. */
  async createSla(input: Record<string, unknown>, userId: string) {
    return this.runAction(
      async () =>
        this.mapSlaResponse(await this.repository.createSla(input, userId)),
      "Gagal membuat aturan SLA",
    );
  }

  /** Ambil detail aturan SLA. */
  async getSlaById(id: string) {
    return this.getSingleResult(async () => {
      const result = await this.repository.findSlaById(id);
      return result ? this.mapSlaResponse(result) : null;
    }, "Aturan SLA");
  }

  /** Perbarui aturan SLA. */
  async updateSla(id: string, input: Record<string, unknown>) {
    const current = await this.repository.findSlaById(id);

    if (!current) {
      return this.createNotFoundResult("Aturan SLA");
    }

    return this.runAction(
      async () =>
        this.mapSlaResponse(await this.repository.updateSla(id, input)),
      "Gagal memperbarui aturan SLA",
    );
  }

  /** Hapus aturan SLA. */
  async deleteSla(id: string): Promise<ServiceResult<null>> {
    const hasSla = await this.repository.hasSla(id);

    if (!hasSla) {
      return this.createNotFoundResult("Aturan SLA");
    }

    const count = await this.repository.countWorkOrdersBySlaId(id);
    if (count > 0) {
      return this.createValidationResult(SLA_IN_USE_MESSAGE);
    }

    await this.repository.deleteSla(id);
    return { success: true, data: null };
  }

  private async getPaginatedResult<
    TQuery extends { page?: number; limit?: number },
    TItem,
  >(
    query: TQuery,
    handler: (query: TQuery) => Promise<{ data: TItem[]; total: number }>,
  ): Promise<ServiceResult<PaginationPayload<TItem>>> {
    try {
      const result = await handler(query);
      return {
        success: true,
        data: this.buildPaginationPayload(result, query),
      };
    } catch {
      return {
        success: false,
        error: "Gagal mengambil data konfigurasi",
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
  }

  private async getSingleResult<T>(
    handler: () => Promise<T | null>,
    resource: string,
  ): Promise<ServiceResult<T>> {
    try {
      const data = await handler();
      if (!data) {
        return this.createNotFoundResult(resource);
      }
      return { success: true, data };
    } catch {
      return {
        success: false,
        error: `Gagal mengambil ${resource.toLowerCase()}`,
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
  }

  private async updateSingleResult<T>(
    finder: () => Promise<T | null>,
    updater: () => Promise<T>,
    resource: string,
    errorMessage: string,
  ): Promise<ServiceResult<T>> {
    try {
      const current = await finder();
      if (!current) {
        return this.createNotFoundResult(resource);
      }
      return { success: true, data: await updater() };
    } catch {
      return {
        success: false,
        error: errorMessage,
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
  }

  private async runAction<T>(
    handler: () => Promise<T>,
    errorMessage: string,
  ): Promise<ServiceResult<T>> {
    try {
      return { success: true, data: await handler() };
    } catch {
      return {
        success: false,
        error: errorMessage,
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
  }

  private buildPaginationPayload<T>(
    result: { data: T[]; total: number },
    query: { page?: number; limit?: number },
  ): PaginationPayload<T> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return {
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  private mapSlaResponse<T extends Record<string, unknown>>(sla: T) {
    const { workOrderEscalations, ...rest } = sla;
    return { ...rest, escalations: workOrderEscalations };
  }

  private createNotFoundResult(resource: string): ServiceResult<never> {
    return {
      success: false,
      error: `${resource} tidak ditemukan`,
      code: ErrorCodes.NOT_FOUND,
    };
  }

  private createValidationResult(message: string): ServiceResult<never> {
    return {
      success: false,
      error: message,
      code: ErrorCodes.VALIDATION_ERROR,
    };
  }
}

export const adminWorkOrderConfigService = new AdminWorkOrderConfigService();
