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
      ...this.toDomainIdentity(model),
      ...this.toDomainLocation(model),
      ...this.toDomainAudit(model),
    };
  }

  /** Map base identity fields to domain shape. */
  private static toDomainIdentity(
    model: Registrations,
  ): Pick<
    Registration,
    | "id"
    | "name"
    | "email"
    | "phone"
    | "address"
    | "packageName"
    | "ipAddress"
    | "status"
    | "notes"
    | "phoneNumber"
    | "tenantId"
  > {
    return {
      id: model.id,
      name: model.name,
      email: model.email,
      phone: model.phone,
      address: model.address,
      packageName: model.packageName ?? null,
      ipAddress: model.ipAddress ?? null,
      status: model.status,
      notes: model.notes ?? null,
      phoneNumber: model.phoneNumber ?? null,
      tenantId: model.tenantId ?? null,
    };
  }

  /** Map location fields to domain shape. */
  private static toDomainLocation(
    model: Registrations,
  ): Pick<Registration, "location" | "latitude" | "longitude"> {
    return {
      location: model.location ?? null,
      latitude: model.latitude ?? null,
      longitude: model.longitude ?? null,
    };
  }

  /** Map audit fields to domain shape. */
  private static toDomainAudit(
    model: Registrations,
  ): Pick<
    Registration,
    "rejectionReason" | "verifiedAt" | "verifiedBy" | "createdAt" | "updatedAt"
  > {
    return {
      rejectionReason: model.rejectionReason ?? null,
      verifiedAt: model.verifiedAt ?? null,
      verifiedBy: model.verifiedBy ?? null,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
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
