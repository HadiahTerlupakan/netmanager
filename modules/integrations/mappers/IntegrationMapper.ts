import type {
  MixRadiusConfig,
  MixRadiusCustomer,
  MixRadiusOwnerGroup,
} from "@prisma/client-billing";

import type {
  IntegrationConfigDetailDTO,
  IntegrationConfigListItemDTO,
  IntegrationSyncStatusDTO,
  MixRadiusCustomerDTO,
} from "../dto/IntegrationDTO";
import type { MixRadiusConfigEntity } from "../domain/entities/MixRadiusConfigEntity";
import type { MixRadiusOwnerGroupEntity } from "../domain/entities/MixRadiusOwnerGroupEntity";
import type { MixRadiusSyncedCustomerEntity } from "../domain/entities/MixRadiusSyncedCustomerEntity";

export class IntegrationMapper {
  /** Map Prisma config to domain entity. */
  static toConfigDomain(model: MixRadiusConfig): MixRadiusConfigEntity {
    return { ...model };
  }

  /** Map Prisma synced customer to domain entity. */
  static toSyncedCustomerDomain(
    model: MixRadiusCustomer,
  ): MixRadiusSyncedCustomerEntity {
    return { ...model };
  }

  /** Map Prisma owner group to domain entity. */
  static toOwnerGroupDomain(
    model: MixRadiusOwnerGroup,
  ): MixRadiusOwnerGroupEntity {
    return { ...model };
  }

  /** Map config entity to list DTO. */
  static toConfigListItem(
    entity: MixRadiusConfigEntity,
  ): IntegrationConfigListItemDTO {
    return {
      id: entity.id,
      name: entity.name || "MixRadius Default",
      type: "MIXRADIUS",
      isActive: entity.isDefault,
      lastSyncAt: entity.lastSyncedAt?.toISOString() ?? null,
    };
  }

  /** Map config entities to list DTOs. */
  static toConfigListItems(
    entities: MixRadiusConfigEntity[],
  ): IntegrationConfigListItemDTO[] {
    return entities.map((entity) => this.toConfigListItem(entity));
  }

  /** Map config entity to detail DTO. */
  static toConfigDetail(
    entity: MixRadiusConfigEntity,
    syncStatus?: IntegrationSyncStatusDTO | null,
  ): IntegrationConfigDetailDTO {
    return {
      id: entity.id,
      name: entity.name || "MixRadius Default",
      type: "MIXRADIUS",
      baseUrl: entity.apiUrl,
      isActive: entity.isDefault,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      syncStatus: syncStatus ?? null,
    };
  }

  /** Map synced customer entity to DTO. */
  static toMixRadiusCustomer(
    entity: MixRadiusSyncedCustomerEntity,
  ): MixRadiusCustomerDTO {
    return {
      id: entity.id,
      mixRadiusId: entity.mixRadiusId,
      username: entity.username,
      fullName: entity.fullName,
      address: entity.address,
      phoneNumber: entity.phoneNumber,
      planName: entity.planName,
      status: entity.status,
      expiredOn: entity.expiredOn?.toISOString() ?? null,
      lastSyncedAt: entity.lastSyncedAt.toISOString(),
    };
  }

  /** Map synced customer entities to DTOs. */
  static toMixRadiusCustomers(
    entities: MixRadiusSyncedCustomerEntity[],
  ): MixRadiusCustomerDTO[] {
    return entities.map((entity) => this.toMixRadiusCustomer(entity));
  }

  /** Map sync metadata to DTO. */
  static toSyncStatus(dto: {
    lastSyncAt: Date | null;
    lastSyncStatus: "SUCCESS" | "FAILED" | "IN_PROGRESS" | null;
    recordsSynced: number;
    errorMessage: string | null;
  }): IntegrationSyncStatusDTO {
    return {
      lastSyncAt: dto.lastSyncAt?.toISOString() ?? null,
      lastSyncStatus: dto.lastSyncStatus,
      recordsSynced: dto.recordsSynced,
      errorMessage: dto.errorMessage,
    };
  }
}
