import type { Status } from "../types/pelanggan.enums";
import { PelangganRepository } from "../repositories/PelangganRepository";
import { PelangganFinanceRepository } from "../repositories/PelangganFinanceRepository";

export class PelangganBillingBridgeService {
  private pelangganRepo = new PelangganRepository();
  private pelangganFinanceRepo = new PelangganFinanceRepository();

  findEligibleForBilling(
    dueDateStart: Date,
    dueDateEnd: Date,
    limit: number,
    offset: number,
  ) {
    return this.pelangganRepo.findEligibleForBilling(
      dueDateStart,
      dueDateEnd,
      limit,
      offset,
    );
  }

  findByIdWithHargaPaket(id: string) {
    return this.pelangganRepo.findByIdWithHargaPaket(id);
  }

  findById(id: string) {
    return this.pelangganRepo.findById(id);
  }

  findByIdWithPushToken(pelangganId: string) {
    return this.pelangganRepo.findByIdWithPushToken(pelangganId);
  }

  findManyWithPushToken(tokens: string[]) {
    return this.pelangganRepo.findManyWithPushToken(tokens);
  }

  /** Batch lookup id+nama; pakai ini alih-alih loop findById. */
  findManyByIds(ids: string[]) {
    return this.pelangganRepo.findManyByIds(ids);
  }

  clearPushTokens(tokens: string[]) {
    return this.pelangganRepo.clearPushTokens(tokens);
  }

  updateStatus(id: string, status: Status) {
    return this.pelangganFinanceRepo.updateStatus(id, status);
  }

  updateJatuhTempo(id: string, jatuhTempo: Date) {
    return this.pelangganFinanceRepo.updateJatuhTempo(id, jatuhTempo);
  }

  update(id: string, data: Parameters<PelangganRepository["update"]>[1]) {
    return this.pelangganRepo.update(id, data);
  }

  /** Find customers by site id for finance scope filtering. */
  findBySiteId(siteId: string) {
    return this.pelangganRepo.findAll({ siteId });
  }
}
