import type {
  AvailableWorkOrderEntity,
  MobileAvailableMitraProfileEntity,
  MobileAvailableUserProfileEntity,
} from "../domain/entities/WorkOrderEntity";

export class WorkOrderAvailabilityMapper {
  /** Map Prisma user profile to mobile availability domain entity. */
  static toUserProfileDomain(model: {
    departmentId: string | null;
    siteId: string | null;
    name: string | null;
    userSites: Array<{ siteId: string }>;
  }): MobileAvailableUserProfileEntity {
    return {
      departmentId: model.departmentId,
      siteId: model.siteId,
      name: model.name,
      userSites: model.userSites,
    };
  }

  /** Map Prisma mitra profile to mobile availability domain entity. */
  static toMitraProfileDomain(model: {
    name: string;
    siteId: string | null;
  }): MobileAvailableMitraProfileEntity {
    return {
      name: model.name,
      siteId: model.siteId,
    };
  }

  /** Map Prisma work order record to availability domain entity. */
  static toDomain(model: {
    id: string;
    workOrderNumber: string;
    title: string;
    description: string | null;
    type: string;
    status: string;
    priority: string;
    contactName: string | null;
    contactPhone: string | null;
    locationAddress: string | null;
    scheduledDate: Date | null;
    createdAt: Date;
    tenantId: string | null;
    siteId: string | null;
    departmentId: string | null;
    assignedToId: string | null;
    assignedMitraId: string | null;
    pelanggan: {
      id: string;
      nama: string;
      alamat: string | null;
      noTelp: string | null;
    } | null;
    site: {
      id: string;
      name: string;
      address: string | null;
    } | null;
    department: {
      id: string;
      name: string;
    } | null;
  }): AvailableWorkOrderEntity {
    return {
      id: model.id,
      workOrderNumber: model.workOrderNumber,
      title: model.title,
      description: model.description,
      type: model.type,
      status: model.status,
      priority: model.priority,
      contactName: model.contactName,
      contactPhone: model.contactPhone,
      locationAddress: model.locationAddress,
      scheduledDate: model.scheduledDate,
      createdAt: model.createdAt,
      tenantId: model.tenantId,
      siteId: model.siteId,
      departmentId: model.departmentId,
      assignedToId: model.assignedToId,
      assignedMitraId: model.assignedMitraId,
      pelanggan: model.pelanggan,
      site: model.site,
      department: model.department,
    };
  }
}
