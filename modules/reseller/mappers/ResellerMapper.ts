import type {
  ResellerEntity,
  ResellerOutletEntity,
  ResellerPackagePriceEntity,
  ResellerStatusHistoryEntity,
} from "../domain/entities/ResellerEntity";
import {
  COMPLIANCE_ISSUE_LABELS,
  type ResellerComplianceResult,
} from "../domain/reseller-compliance";
import type {
  ResellerDTO,
  ResellerOutletDTO,
  ResellerPackagePriceDTO,
  ResellerStatusHistoryDTO,
  ResellerWithComplianceDTO,
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
      legalName: entity.legalName,
      nib: entity.nib,
      kbliCode: entity.kbliCode,
      standardCertificateNumber: entity.standardCertificateNumber,
      brandName: entity.brandName,
      licenseVerifiedAt: entity.licenseVerifiedAt?.toISOString() ?? null,
      licenseVerifiedById: entity.licenseVerifiedById,
      statusReason: entity.statusReason,
      statusChangedAt: entity.statusChangedAt?.toISOString() ?? null,
      statusChangedById: entity.statusChangedById,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  /** Map baris riwayat status kemitraan ke DTO admin. */
  static toStatusHistoryDTO(
    entity: ResellerStatusHistoryEntity,
  ): ResellerStatusHistoryDTO {
    return {
      id: entity.id,
      fromStatus: entity.fromStatus,
      toStatus: entity.toStatus,
      reason: entity.reason,
      changedById: entity.changedById,
      changedAt: entity.changedAt.toISOString(),
    };
  }

  /** Map reseller entity plus compliance evaluation to admin DTO. */
  static toWithComplianceDTO(
    entity: ResellerEntity,
    compliance: ResellerComplianceResult,
  ): ResellerWithComplianceDTO {
    return {
      ...ResellerMapper.toDTO(entity),
      compliance: {
        isCompliant: compliance.isCompliant,
        issues: compliance.issues,
        issueLabels: compliance.issues.map(
          (issue) => COMPLIANCE_ISSUE_LABELS[issue],
        ),
        pks: {
          status: compliance.pks.status,
          documentId: compliance.pks.documentId,
          startDate: compliance.pks.startDate?.toISOString() ?? null,
          endDate: compliance.pks.endDate?.toISOString() ?? null,
          daysLeft: compliance.pks.daysLeft,
        },
      },
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
