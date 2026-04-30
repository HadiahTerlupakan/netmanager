/**
 * WorkOrderMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 * Ensures consistent data shape and hides internal fields.
 */

import type { WorkOrderWithRelations } from "../domain/ports/IWorkOrderRepository";
import type {
  WorkOrderListItemDTO,
  WorkOrderDetailDTO,
  WorkOrderMobileDTO,
  WorkOrderTaskDTO,
  WorkOrderMaterialDTO,
  WorkOrderUpdateDTO,
} from "../dto/WorkOrderDTO";

type WorkOrderEntity = WorkOrderWithRelations;

export class WorkOrderMapper {
  /**
   * Map to list item DTO (for table views)
   */
  static toListItem(entity: WorkOrderEntity): WorkOrderListItemDTO {
    return {
      id: entity.id,
      workOrderNumber: entity.workOrderNumber,
      title: entity.title,
      type: entity.type,
      status: entity.status,
      priority: entity.priority,
      scheduledDate: entity.scheduledDate?.toISOString() ?? null,
      createdAt: entity.createdAt.toISOString(),
      // Flattened relations
      pelangganName: entity.pelanggan?.nama ?? null,
      pelangganId: entity.pelangganId ?? null,
      departmentName: entity.department?.name ?? null,
      siteName: entity.site?.name ?? null,
      assignedToName: entity.assignedTo?.name ?? null,
      assignedMitraName: entity.assignedMitra?.name ?? null,
    };
  }

  /**
   * Map array to list items
   */
  static toListItems(entities: WorkOrderEntity[]): WorkOrderListItemDTO[] {
    return entities.map((entity) => this.toListItem(entity));
  }

  /**
   * Map to detail DTO (for single view)
   */
  static toDetail(entity: WorkOrderEntity): WorkOrderDetailDTO {
    return {
      ...this.mapDetailCore(entity),
      ...this.mapDetailRelations(entity),
      tasks: this.mapTasks(entity.tasks ?? []),
      materials: this.mapMaterials(entity.materials ?? []),
      updates: this.mapUpdates(entity.updates ?? []),
    };
  }

  /**
   * Map to mobile DTO (simplified for mobile app)
   */
  static toMobile(entity: WorkOrderEntity): WorkOrderMobileDTO {
    return {
      id: entity.id,
      workOrderNumber: entity.workOrderNumber,
      title: entity.title,
      type: entity.type,
      status: entity.status,
      priority: entity.priority,
      scheduledDate: entity.scheduledDate?.toISOString() ?? null,
      locationAddress: entity.locationAddress ?? null,
      contactName: entity.contactName ?? entity.pelanggan?.nama ?? null,
      contactPhone: entity.contactPhone ?? entity.pelanggan?.noTelp ?? null,
      tasks: (entity.tasks ?? []).map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
      })),
    };
  }

  /**
   * Map array to mobile DTOs
   */
  static toMobileList(entities: WorkOrderEntity[]): WorkOrderMobileDTO[] {
    return entities.map((entity) => this.toMobile(entity));
  }

  // ==================== Private Helpers ====================

  private static mapDetailCore(entity: WorkOrderEntity) {
    return {
      id: entity.id,
      workOrderNumber: entity.workOrderNumber,
      title: entity.title,
      description: entity.description ?? "",
      type: entity.type,
      status: entity.status,
      priority: entity.priority,
      scheduledDate: entity.scheduledDate?.toISOString() ?? null,
      completedAt: entity.completedAt?.toISOString() ?? null,
      resolutionNotes: entity.resolutionNotes ?? null,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private static mapDetailRelations(entity: WorkOrderEntity) {
    return {
      pelanggan: this.mapPelanggan(entity),
      department: entity.department
        ? {
            id: entity.department.id,
            name: entity.department.name,
          }
        : null,
      site: entity.site ? { id: entity.site.id, name: entity.site.name } : null,
      assignedTo: this.mapAssignedTo(entity),
      assignedMitra: entity.assignedMitra
        ? {
            id: entity.assignedMitra.id,
            name: entity.assignedMitra.name,
          }
        : null,
      createdBy: entity.createdBy
        ? {
            id: entity.createdBy.id,
            name: entity.createdBy.name ?? null,
          }
        : null,
    };
  }

  private static mapPelanggan(entity: WorkOrderEntity) {
    if (!entity.pelanggan) return null;
    return {
      id: entity.pelanggan.id,
      idPelanggan: entity.pelanggan.idPelanggan,
      nama: entity.pelanggan.nama,
      noTelp: entity.pelanggan.noTelp ?? null,
    };
  }

  private static mapAssignedTo(entity: WorkOrderEntity) {
    if (!entity.assignedTo) return null;
    return {
      id: entity.assignedTo.id,
      name: entity.assignedTo.name ?? null,
      email: entity.assignedTo.email,
    };
  }

  private static mapTasks(
    tasks: Array<{
      id: string;
      title: string;
      description: string | null;
      status: string;
      order: number;
      completedAt: Date | null;
    }>,
  ): WorkOrderTaskDTO[] {
    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      order: task.order,
      completedAt: task.completedAt?.toISOString() ?? null,
    }));
  }

  private static mapMaterials(
    materials: Array<{
      id: string;
      quantity: number;
      satuan: string | null;
      notes: string | null;
      barang?: {
        name?: string;
        nama?: string;
        kodeBarang?: string | null;
        kode?: string | null;
      } | null;
    }>,
  ): WorkOrderMaterialDTO[] {
    return materials.map((mat) => ({
      id: mat.id,
      barangName: mat.barang?.name ?? mat.barang?.nama ?? "Unknown",
      barangCode: mat.barang?.kodeBarang ?? mat.barang?.kode ?? null,
      quantity: mat.quantity,
      satuan: mat.satuan,
      notes: mat.notes,
    }));
  }

  private static mapUpdates(
    updates: Array<{
      id: string;
      message: string;
      createdAt: Date;
      user?: {
        id: string;
        name: string | null;
      } | null;
    }>,
  ): WorkOrderUpdateDTO[] {
    return updates.map((update) => ({
      id: update.id,
      message: update.message,
      createdAt: update.createdAt.toISOString(),
      createdBy: update.user
        ? {
            id: update.user.id,
            name: update.user.name,
          }
        : null,
    }));
  }
}
