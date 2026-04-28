/**
 * WorkOrderFactory
 *
 * Factory pattern for creating WorkOrder with different configurations.
 * Encapsulates the creation logic for various work order types.
 */

import type { WorkOrderPriority, WorkOrderType } from "@prisma/client";
import type { CreateWorkOrderInput } from "../services/WorkOrderService";
import type {
  CreateInstallationDTO,
  CreateDisconnectionDTO,
  CreateTroubleshootingDTO,
  CreateMaintenanceDTO,
} from "../dto/WorkOrderDTO";
import { prisma } from "@/lib/prisma";

export class WorkOrderFactory {
  /**
   * Create input for INSTALLATION work order
   */
  static async createInstallation(
    dto: CreateInstallationDTO,
  ): Promise<CreateWorkOrderInput> {
    // Fetch pelanggan data for title
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: dto.pelangganId },
      select: { nama: true, idPelanggan: true, alamat: true },
    });

    if (!pelanggan) {
      throw new Error("Pelanggan tidak ditemukan");
    }

    return {
      type: "INSTALLATION" as WorkOrderType,
      title: `Instalasi Baru: ${pelanggan.nama} (${pelanggan.idPelanggan})`,
      description: this.buildInstallationDescription(pelanggan, dto.notes),
      priority: "NORMAL" as WorkOrderPriority,
      pelangganId: dto.pelangganId,
      departmentId: dto.departmentId,
      siteId: dto.siteId,
      scheduledDate: dto.scheduledDate,
    };
  }

  /**
   * Create input for DISCONNECTION work order
   */
  static async createDisconnection(
    dto: CreateDisconnectionDTO,
  ): Promise<CreateWorkOrderInput> {
    // Fetch pelanggan data for title
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: dto.pelangganId },
      select: { nama: true, idPelanggan: true, alamat: true },
    });

    if (!pelanggan) {
      throw new Error("Pelanggan tidak ditemukan");
    }

    return {
      type: "DISCONNECTION" as WorkOrderType,
      title: `Dismantle: ${pelanggan.nama} (${pelanggan.idPelanggan})`,
      description: this.buildDisconnectionDescription(
        pelanggan,
        dto.reason,
        dto.notes,
      ),
      priority: "NORMAL" as WorkOrderPriority,
      pelangganId: dto.pelangganId,
      departmentId: dto.departmentId,
      siteId: dto.siteId,
    };
  }

  /**
   * Create input for TROUBLESHOOTING work order
   */
  static createTroubleshooting(
    dto: CreateTroubleshootingDTO,
  ): CreateWorkOrderInput {
    return {
      type: "TROUBLESHOOTING" as WorkOrderType,
      title: dto.title,
      description: dto.description,
      priority: (dto.priority ?? "HIGH") as WorkOrderPriority,
      pelangganId: dto.pelangganId,
      ticketId: dto.ticketId,
      departmentId: dto.departmentId,
      siteId: dto.siteId,
      scheduledDate: dto.scheduledDate,
    };
  }

  /**
   * Create input for MAINTENANCE work order
   */
  static createMaintenance(dto: CreateMaintenanceDTO): CreateWorkOrderInput {
    return {
      type: "MAINTENANCE" as WorkOrderType,
      title: dto.title,
      description: dto.description,
      priority: (dto.priority ?? "LOW") as WorkOrderPriority,
      departmentId: dto.departmentId,
      siteId: dto.siteId,
      scheduledDate: dto.scheduledDate,
      isInternal: dto.isInternal ?? true,
    };
  }

  /**
   * Create input for RELOCATION work order
   */
  static async createRelocation(dto: {
    pelangganId: string;
    newAddress: string;
    departmentId?: string;
    siteId?: string;
    scheduledDate?: string;
    notes?: string;
  }): Promise<CreateWorkOrderInput> {
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: dto.pelangganId },
      select: { nama: true, idPelanggan: true, alamat: true },
    });

    if (!pelanggan) {
      throw new Error("Pelanggan tidak ditemukan");
    }

    return {
      type: "RELOCATION" as WorkOrderType,
      title: `Pindah Alamat: ${pelanggan.nama} (${pelanggan.idPelanggan})`,
      description: this.buildRelocationDescription(
        pelanggan,
        dto.newAddress,
        dto.notes,
      ),
      priority: "NORMAL" as WorkOrderPriority,
      pelangganId: dto.pelangganId,
      departmentId: dto.departmentId,
      siteId: dto.siteId,
      scheduledDate: dto.scheduledDate,
    };
  }

  // ==================== Private Helpers ====================

  private static buildInstallationDescription(
    pelanggan: { nama: string; idPelanggan: string; alamat: string | null },
    notes?: string,
  ): string {
    let desc = `Pemasangan perangkat baru untuk pelanggan.\n\n`;
    desc += `Pelanggan: ${pelanggan.nama}\n`;
    desc += `ID: ${pelanggan.idPelanggan}\n`;
    desc += `Alamat: ${pelanggan.alamat || "-"}\n`;
    if (notes) {
      desc += `\nCatatan: ${notes}`;
    }
    return desc;
  }

  private static buildDisconnectionDescription(
    pelanggan: { nama: string; idPelanggan: string; alamat: string | null },
    reason: string,
    notes?: string,
  ): string {
    let desc = `Pembongkaran perangkat pelanggan.\n\n`;
    desc += `Pelanggan: ${pelanggan.nama}\n`;
    desc += `ID: ${pelanggan.idPelanggan}\n`;
    desc += `Alamat: ${pelanggan.alamat || "-"}\n`;
    desc += `\nAlasan: ${reason}\n`;
    if (notes) {
      desc += `Catatan: ${notes}`;
    }
    return desc;
  }

  private static buildRelocationDescription(
    pelanggan: { nama: string; idPelanggan: string; alamat: string | null },
    newAddress: string,
    notes?: string,
  ): string {
    let desc = `Pemindahan lokasi pelanggan.\n\n`;
    desc += `Pelanggan: ${pelanggan.nama}\n`;
    desc += `ID: ${pelanggan.idPelanggan}\n`;
    desc += `Alamat Lama: ${pelanggan.alamat || "-"}\n`;
    desc += `Alamat Baru: ${newAddress}\n`;
    if (notes) {
      desc += `\nCatatan: ${notes}`;
    }
    return desc;
  }
}
