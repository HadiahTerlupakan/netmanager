import type { Registrations } from "@prisma/client";
import type { Registration } from "../domain/entities/Registration";
import type {
  RegistrationDetailDTO,
  RegistrationListItemDTO,
} from "../dto/RegistrationDTO";

export class RegistrationMapper {
  /** Map Prisma registration model to domain entity. */
  static toDomain(model: Registrations): Registration {
    return {
      id: model.id,
      name: model.name,
      email: model.email,
      phone: model.phone,
      address: model.address,
      packageName: model.packageName ?? null,
      location: model.location ?? null,
      latitude: model.latitude ?? null,
      longitude: model.longitude ?? null,
      ipAddress: model.ipAddress ?? null,
      status: model.status,
      notes: model.notes ?? null,
      rejectionReason: model.rejectionReason ?? null,
      verifiedAt: model.verifiedAt ?? null,
      verifiedBy: model.verifiedBy ?? null,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      phoneNumber: model.phoneNumber ?? null,
      tenantId: model.tenantId ?? null,
    };
  }

  /** Map domain entity to list DTO. */
  static toListDTO(entity: Registration): RegistrationListItemDTO {
    return {
      id: entity.id,
      name: entity.name,
      email: entity.email,
      phone: entity.phone,
      address: entity.address,
      location: entity.location,
      packageName: entity.packageName,
      ipAddress: entity.ipAddress,
      status: entity.status,
      notes: entity.notes,
      createdAt: entity.createdAt.toISOString(),
    };
  }

  /** Map domain entity to detail DTO. */
  static toDTO(entity: Registration): RegistrationDetailDTO {
    return {
      id: entity.id,
      name: entity.name,
      email: entity.email,
      phone: entity.phone,
      address: entity.address,
      location: entity.location,
      packageName: entity.packageName,
      ipAddress: entity.ipAddress,
      status: entity.status,
      notes: entity.notes,
      rejectionReason: entity.rejectionReason,
      verifiedAt: entity.verifiedAt?.toISOString() ?? null,
      verifiedBy: entity.verifiedBy,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  /** Map domain entities to list DTO collection. */
  static toListDTOs(entities: Registration[]): RegistrationListItemDTO[] {
    return entities.map((entity) => this.toListDTO(entity));
  }
}
