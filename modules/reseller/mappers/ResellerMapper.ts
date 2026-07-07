import type {
  ResellerEntity,
  ResellerOutletEntity,
  ResellerPackagePriceEntity,
} from "../domain/entities/ResellerEntity";
import type {
  ResellerDTO,
  ResellerOutletDTO,
  ResellerPackagePriceDTO,
} from "../dto/reseller.dto";

export class ResellerMapper {
  /** Map reseller entity to API DTO. */
  static toDTO(entity: ResellerEntity): ResellerDTO {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      code: entity.code,
      name: entity.name,
      email: entity.email,
      phone: entity.phone,
      address: entity.address,
      status: entity.status,
      notes: entity.notes,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  /** Map reseller outlet entity to API DTO. */
  static toOutletDTO(entity: ResellerOutletEntity): ResellerOutletDTO {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      resellerId: entity.resellerId,
      code: entity.code,
      name: entity.name,
      phone: entity.phone,
      address: entity.address,
      status: entity.status,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  /** Map reseller package price entity to API DTO. */
  static toPackagePriceDTO(
    entity: ResellerPackagePriceEntity,
  ): ResellerPackagePriceDTO {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      resellerId: entity.resellerId,
      hargaPaketId: entity.hargaPaketId,
      price: entity.price,
      status: entity.status,
      startsAt: entity.startsAt.toISOString(),
      endsAt: entity.endsAt?.toISOString() ?? null,
    };
  }
}
