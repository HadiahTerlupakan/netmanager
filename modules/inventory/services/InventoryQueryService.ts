import { InventoryRepository } from "../repositories/InventoryRepository";

export class InventoryQueryService {
  constructor(private readonly repository = new InventoryRepository()) {}

  /** Get inventory summary rows for dashboard consumers. */
  async findAllBarang(input: { take?: number; tenantId?: string }) {
    const result = await this.repository.findAllBarang(input);
    return { total: result.total };
  }
}
