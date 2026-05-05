import {
  AdminWorkOrderConfigRepository,
  type EscalationListQuery,
  type SlaListQuery,
  type TemplateListQuery,
} from "../repositories/AdminWorkOrderConfigRepository";
import {
  createNotFoundResult,
  createValidationResult,
  getPaginatedResult,
  getSingleResult,
  mapSlaResponse,
  runConfigAction,
  type PaginationPayload,
  type ServiceResult,
  updateSingleResult,
} from "./admin-work-order-config.helpers";

const TEMPLATE_IN_USE_MESSAGE =
  "Tidak dapat menghapus template yang sedang digunakan oleh work order";
const SLA_IN_USE_MESSAGE =
  "Tidak dapat menghapus aturan SLA yang sedang digunakan oleh work order";

/** Service route tipis untuk konfigurasi admin work order. */
export class AdminWorkOrderConfigService {
  private readonly repository = new AdminWorkOrderConfigRepository();

  /** Ambil daftar template work order. */
  async getTemplates(
    query: TemplateListQuery,
  ): Promise<ServiceResult<PaginationPayload<unknown>>> {
    return getPaginatedResult(query, (input) =>
      this.repository.findTemplates(input),
    );
  }

  /** Buat template work order baru. */
  async createTemplate(input: Record<string, unknown>, userId: string) {
    return runConfigAction(
      () => this.repository.createTemplate(input, userId),
      "Gagal membuat template work order",
    );
  }

  /** Ambil detail template work order. */
  async getTemplateById(id: string) {
    return getSingleResult(
      () => this.repository.findTemplateById(id),
      "Template Work Order",
    );
  }

  /** Perbarui template work order. */
  async updateTemplate(id: string, input: Record<string, unknown>) {
    return updateSingleResult({
      finder: () => this.repository.findTemplateById(id),
      updater: () => this.repository.updateTemplate(id, input),
      resource: "Template Work Order",
      errorMessage: "Gagal memperbarui template work order",
    });
  }

  /** Hapus template work order. */
  async deleteTemplate(id: string): Promise<ServiceResult<null>> {
    const template = await this.repository.findTemplateById(id);

    if (!template) {
      return createNotFoundResult("Template Work Order");
    }

    const count = await this.repository.countWorkOrdersByTemplateId(id);
    if (count > 0) {
      return createValidationResult(TEMPLATE_IN_USE_MESSAGE);
    }

    await this.repository.deleteTemplate(id);
    return { success: true, data: null };
  }

  /** Ambil daftar escalation rule. */
  async getEscalations(
    query: EscalationListQuery,
  ): Promise<ServiceResult<PaginationPayload<unknown>>> {
    return getPaginatedResult(query, (input) =>
      this.repository.findEscalations(input),
    );
  }

  /** Buat escalation rule baru. */
  async createEscalation(input: Record<string, unknown>, userId: string) {
    return runConfigAction(
      () => this.repository.createEscalation(input, userId),
      "Gagal membuat aturan eskalasi",
    );
  }

  /** Ambil detail escalation rule. */
  async getEscalationById(id: string) {
    return getSingleResult(
      () => this.repository.findEscalationById(id),
      "Aturan Eskalasi",
    );
  }

  /** Perbarui escalation rule. */
  async updateEscalation(id: string, input: Record<string, unknown>) {
    return updateSingleResult({
      finder: () => this.repository.findEscalationById(id),
      updater: () => this.repository.updateEscalation(id, input),
      resource: "Aturan Eskalasi",
      errorMessage: "Gagal memperbarui aturan eskalasi",
    });
  }

  /** Hapus escalation rule. */
  async deleteEscalation(id: string): Promise<ServiceResult<null>> {
    const escalation = await this.repository.findEscalationById(id);

    if (!escalation) {
      return createNotFoundResult("Aturan Eskalasi");
    }

    await this.repository.deleteEscalation(id);
    return { success: true, data: null };
  }

  /** Ambil daftar aturan SLA. */
  async getSlas(
    query: SlaListQuery,
  ): Promise<ServiceResult<PaginationPayload<unknown>>> {
    return getPaginatedResult(query, async (input) => {
      const result = await this.repository.findSlas(input);
      return {
        data: result.data.map((item) => mapSlaResponse(item)),
        total: result.total,
      };
    });
  }

  /** Buat aturan SLA baru. */
  async createSla(input: Record<string, unknown>, userId: string) {
    return runConfigAction(
      async () =>
        mapSlaResponse(await this.repository.createSla(input, userId)),
      "Gagal membuat aturan SLA",
    );
  }

  /** Ambil detail aturan SLA. */
  async getSlaById(id: string) {
    return getSingleResult(async () => {
      const result = await this.repository.findSlaById(id);
      return result ? mapSlaResponse(result) : null;
    }, "Aturan SLA");
  }

  /** Perbarui aturan SLA. */
  async updateSla(id: string, input: Record<string, unknown>) {
    const current = await this.repository.findSlaById(id);

    if (!current) {
      return createNotFoundResult("Aturan SLA");
    }

    return runConfigAction(
      async () => mapSlaResponse(await this.repository.updateSla(id, input)),
      "Gagal memperbarui aturan SLA",
    );
  }

  /** Hapus aturan SLA. */
  async deleteSla(id: string): Promise<ServiceResult<null>> {
    const hasSla = await this.repository.hasSla(id);

    if (!hasSla) {
      return createNotFoundResult("Aturan SLA");
    }

    const count = await this.repository.countWorkOrdersBySlaId(id);
    if (count > 0) {
      return createValidationResult(SLA_IN_USE_MESSAGE);
    }

    await this.repository.deleteSla(id);
    return { success: true, data: null };
  }
}

let adminWorkOrderConfigServiceInstance: AdminWorkOrderConfigService | null =
  null;

/** Return the shared admin work-order config service lazily. */
export function getAdminWorkOrderConfigService() {
  adminWorkOrderConfigServiceInstance ??= new AdminWorkOrderConfigService();
  return adminWorkOrderConfigServiceInstance;
}
