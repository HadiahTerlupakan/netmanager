import { logger } from "@/lib/logger";
import { OltCardRepository } from "../repositories/OltCardRepository";
import { OltRepository } from "../repositories/OltRepository";
import { OltAdapterFactory } from "../adapters/OltAdapterFactory";
import type { OltDevice } from "../domain/entities/olt-device.entity";
import type {
  OltCard,
  OltCardListItem,
  OltCardUpdateInput,
  OltCardError,
} from "../domain/entities/olt-card.entity";

type Result<T, E> = { success: true; data: T } | { success: false; error: E };

export class OltCardService {
  private repo = new OltCardRepository();
  private oltRepo = new OltRepository();
  private adapterFactory = new OltAdapterFactory();

  async listByOlt(
    tenantId: string,
    oltId: string,
  ): Promise<Result<OltCardListItem[], OltCardError>> {
    const device = await this.oltRepo.findById(oltId, tenantId);
    if (!device) {
      return {
        success: false,
        error: { code: "OLT_NOT_FOUND", message: "OLT tidak ditemukan" },
      };
    }

    const cards = await this.repo.listByOlt(tenantId, oltId);
    return { success: true, data: cards };
  }

  async syncCards(
    tenantId: string,
    oltId: string,
  ): Promise<Result<{ synced: number; mode: string }, OltCardError>> {
    const device = await this.oltRepo.findById(oltId, tenantId);
    if (!device) {
      return {
        success: false,
        error: { code: "OLT_NOT_FOUND", message: "OLT tidak ditemukan" },
      };
    }

    if (device.vendor === "ZTE") {
      return this.syncCardsViaSnmp(tenantId, device);
    }

    return this.syncCardsBuiltin(tenantId, device);
  }

  async updateCard(
    tenantId: string,
    oltId: string,
    cardId: string,
    input: OltCardUpdateInput,
  ): Promise<Result<OltCard, OltCardError>> {
    const device = await this.oltRepo.findById(oltId, tenantId);
    if (!device) {
      return {
        success: false,
        error: { code: "OLT_NOT_FOUND", message: "OLT tidak ditemukan" },
      };
    }

    const existing = await this.repo.findById(cardId, tenantId);
    if (!existing) {
      return {
        success: false,
        error: { code: "CARD_NOT_FOUND", message: "Card tidak ditemukan" },
      };
    }

    const updated = await this.repo.updateById(cardId, tenantId, input);
    return { success: true, data: updated };
  }

  private async syncCardsViaSnmp(
    tenantId: string,
    device: OltDevice,
  ): Promise<Result<{ synced: number; mode: string }, OltCardError>> {
    if (!device.snmpCommunity) {
      return {
        success: false,
        error: {
          code: "INVALID_CONFIG",
          message: "SNMP community belum dikonfigurasi",
        },
      };
    }

    const adapter = this.adapterFactory.getAdapter("ZTE");
    if (!adapter.discoverCards) {
      return {
        success: false,
        error: {
          code: "ADAPTER_ERROR",
          message: "Adapter tidak support discoverCards",
        },
      };
    }

    const result = await adapter.discoverCards(device);
    if (!result.success) {
      const code =
        result.code === "SNMP_TIMEOUT" ? "SNMP_TIMEOUT" : "ADAPTER_ERROR";
      return {
        success: false,
        error: {
          code,
          message: result.error ?? "Card discovery gagal",
        },
      };
    }

    const cards = result.data ?? [];
    let synced = 0;
    for (const card of cards) {
      await this.repo.upsertByPosition({
        tenantId,
        oltId: device.id,
        slotFrame: card.slotFrame,
        slot: card.slot,
        cardType: card.cardType,
        ponCount: card.ponCount,
        status: card.status,
      });
      synced++;
    }

    logger.info(
      `[OltCardService] Synced ${synced} cards for OLT ${device.id} via SNMP`,
    );
    return { success: true, data: { synced, mode: "snmp" } };
  }

  private async syncCardsBuiltin(
    tenantId: string,
    device: OltDevice,
  ): Promise<Result<{ synced: number; mode: string }, OltCardError>> {
    if (!device.totalPonPorts || device.totalPonPorts < 1) {
      return {
        success: false,
        error: {
          code: "INVALID_CONFIG",
          message: "Lengkapi konfigurasi totalPonPorts di OLT terlebih dulu",
        },
      };
    }

    await this.repo.upsertByPosition({
      tenantId,
      oltId: device.id,
      slotFrame: device.defaultSlotFrame ?? 1,
      slot: device.defaultSlot ?? 1,
      cardType: "BUILTIN",
      ponCount: device.totalPonPorts,
      status: "ACTIVE",
    });

    logger.info(`[OltCardService] Seeded BUILTIN card for OLT ${device.id}`);
    return { success: true, data: { synced: 1, mode: "builtin" } };
  }
}
