import { prisma } from "@/lib/prisma";
import type { CreateShiftDTO, UpdateShiftDTO } from "../dto/ShiftDTO";
import type { ShiftEntity } from "../domain/entities/ShiftEntity";
import type { IShiftRepository } from "../domain/ports/IShiftRepository";
import { ShiftMapper } from "../mappers/ShiftMapper";

const DELETE_TIMESTAMP_DIVISOR = 1000;
const DELETED_CODE_SUFFIX = "_DEL_";

export class ShiftRepository implements IShiftRepository {
  /** Mengambil semua shift untuk tenant tertentu. */
  async findAll(
    tenantId: string,
    includeInactive = false,
  ): Promise<ShiftEntity[]> {
    const records = await prisma.shift.findMany({
      where: this.buildFindAllWhere(tenantId, includeInactive),
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    });

    return ShiftMapper.toDomainList(records);
  }

  /** Mengambil shift berdasarkan id. */
  async findById(tenantId: string, id: string): Promise<ShiftEntity | null> {
    const record = await prisma.shift.findFirst({
      where: { id, tenantId },
      include: { users: { select: { id: true, name: true, email: true } } },
    });

    return record ? ShiftMapper.toDomain(record) : null;
  }

  /** Mengambil shift berdasarkan kode. */
  async findByCode(
    tenantId: string,
    code: string,
  ): Promise<ShiftEntity | null> {
    const record = await prisma.shift.findFirst({
      where: { code, tenantId },
      include: { _count: { select: { users: true } } },
    });

    return record ? ShiftMapper.toDomain(record) : null;
  }

  /** Membuat shift baru. */
  async create(tenantId: string, data: CreateShiftDTO): Promise<ShiftEntity> {
    const record = await prisma.shift.create({
      data: this.buildCreateData(tenantId, data),
      include: { users: { select: { id: true, name: true, email: true } } },
    });

    return ShiftMapper.toDomain(record);
  }

  /** Memperbarui data shift. */
  async update(
    tenantId: string,
    id: string,
    data: UpdateShiftDTO,
  ): Promise<ShiftEntity> {
    const record = await prisma.shift.update({
      where: { id, tenantId },
      data: this.buildUpdateData(data),
      include: { users: { select: { id: true, name: true, email: true } } },
    });

    return ShiftMapper.toDomain(record);
  }

  /** Melakukan soft delete pada shift. */
  async delete(tenantId: string, id: string): Promise<void> {
    const shift = await this.findById(tenantId, id);
    if (!shift) {
      return;
    }

    await prisma.shift.update({
      where: { id, tenantId },
      data: this.buildSoftDeleteData(shift.code),
    });
  }

  /** Menghapus shift secara permanen. */
  async hardDelete(tenantId: string, id: string): Promise<void> {
    await prisma.shift.delete({
      where: { id, tenantId },
    });
  }

  /** Menghitung jumlah user yang memakai shift. */
  async getUserCount(tenantId: string, shiftId: string): Promise<number> {
    return prisma.user.count({
      where: { shiftId, tenantId },
    });
  }

  private buildFindAllWhere(tenantId: string, includeInactive: boolean) {
    if (includeInactive) {
      return { tenantId };
    }

    return { tenantId, isActive: true };
  }

  private buildCreateData(tenantId: string, data: CreateShiftDTO) {
    return {
      tenantId,
      name: data.name,
      code: data.code ?? null,
      startTime: data.startTime,
      endTime: data.endTime,
      description: data.description ?? null,
      isActive: data.isActive ?? true,
    };
  }

  private buildUpdateData(data: UpdateShiftDTO) {
    return {
      name: data.name,
      code: data.code,
      startTime: data.startTime,
      endTime: data.endTime,
      description: data.description,
      isActive: data.isActive,
    };
  }

  private buildSoftDeleteData(code: string | null) {
    if (!code) {
      return { isActive: false };
    }

    return {
      isActive: false,
      code: `${code}${DELETED_CODE_SUFFIX}${this.getDeleteTimestamp()}`,
    };
  }

  private getDeleteTimestamp(): number {
    return Math.floor(Date.now() / DELETE_TIMESTAMP_DIVISOR);
  }
}
