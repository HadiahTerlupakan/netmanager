import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import type {
  CreateShiftDTO,
  ShiftDetailDTO,
  ShiftListItemDTO,
  UpdateShiftDTO,
} from "../dto/ShiftDTO";
import type { IShiftRepository } from "../domain/ports/IShiftRepository";
import { ShiftMapper } from "../mappers/ShiftMapper";
import { ShiftRepository } from "../repositories/ShiftRepository";

const TIME_FORMAT_REGEX = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

export class ShiftService {
  private readonly repository: IShiftRepository;

  constructor(repository: IShiftRepository = new ShiftRepository()) {
    this.repository = repository;
  }

  /** Mengambil semua shift dalam bentuk DTO list. */
  async getAllShifts(
    tenantId: string,
    includeInactive = false,
  ): Promise<ShiftListItemDTO[]> {
    const shifts = await this.repository.findAll(tenantId, includeInactive);
    return ShiftMapper.toListDTOs(shifts);
  }

  /** Mengambil detail shift berdasarkan id. */
  async getShiftById(
    tenantId: string,
    id: string,
  ): Promise<ShiftDetailDTO | null> {
    const shift = await this.repository.findById(tenantId, id);
    return shift ? ShiftMapper.toDetailDTO(shift) : null;
  }

  /** Membuat shift baru setelah validasi. */
  async createShift(
    tenantId: string,
    input: CreateShiftDTO,
  ): Promise<ShiftDetailDTO> {
    this.validateShiftTimes(input.startTime, input.endTime);
    await this.ensureCodeAvailable(tenantId, input.code);

    const shift = await this.repository.create(tenantId, input);
    return ShiftMapper.toDetailDTO(shift);
  }

  /** Memperbarui shift setelah validasi. */
  async updateShift(
    tenantId: string,
    id: string,
    input: UpdateShiftDTO,
  ): Promise<ShiftDetailDTO> {
    const existingShift = await this.getExistingShift(tenantId, id);
    this.validateOptionalShiftTimes(input);
    await this.ensureUpdatedCodeAvailable(
      tenantId,
      input.code,
      existingShift.code,
    );

    const shift = await this.repository.update(tenantId, id, input);
    return ShiftMapper.toDetailDTO(shift);
  }

  /** Menghapus shift secara soft atau hard delete. */
  async deleteShift(
    tenantId: string,
    id: string,
    force = false,
  ): Promise<void> {
    await this.getExistingShift(tenantId, id);
    await this.ensureShiftCanBeDeleted(tenantId, id, force);

    try {
      await this.executeDelete(tenantId, id, force);
    } catch (error) {
      this.handleDeleteError(error);
    }
  }

  private validateShiftTimes(startTime: string, endTime: string): void {
    this.validateTimeFormat(startTime, "start");
    this.validateTimeFormat(endTime, "end");
  }

  private validateOptionalShiftTimes(input: UpdateShiftDTO): void {
    if (input.startTime) {
      this.validateTimeFormat(input.startTime, "start");
    }

    if (input.endTime) {
      this.validateTimeFormat(input.endTime, "end");
    }
  }

  private validateTimeFormat(time: string, label: "start" | "end"): void {
    if (TIME_FORMAT_REGEX.test(time)) {
      return;
    }

    throw new Error(`Invalid ${label} time format. Use HH:mm`);
  }

  private async ensureCodeAvailable(
    tenantId: string,
    code?: string,
  ): Promise<void> {
    if (!code) {
      return;
    }

    const existingShift = await this.repository.findByCode(tenantId, code);
    if (!existingShift) {
      return;
    }

    throw new Error("Shift code already exists");
  }

  private async getExistingShift(tenantId: string, id: string) {
    const existingShift = await this.repository.findById(tenantId, id);
    if (existingShift) {
      return existingShift;
    }

    throw new Error("Shift not found");
  }

  private async ensureUpdatedCodeAvailable(
    tenantId: string,
    nextCode?: string,
    currentCode?: string | null,
  ): Promise<void> {
    if (!nextCode || nextCode === currentCode) {
      return;
    }

    await this.ensureCodeAvailable(tenantId, nextCode);
  }

  private async ensureShiftCanBeDeleted(
    tenantId: string,
    shiftId: string,
    force: boolean,
  ): Promise<void> {
    const userCount = await this.repository.getUserCount(tenantId, shiftId);
    if (userCount === 0 || force) {
      return;
    }

    throw new Error(
      `Cannot delete shift. It is assigned to ${userCount} user(s). Use force=true to soft delete.`,
    );
  }

  private async executeDelete(
    tenantId: string,
    id: string,
    force: boolean,
  ): Promise<void> {
    if (force) {
      await this.repository.delete(tenantId, id);
      return;
    }

    await this.repository.hardDelete(tenantId, id);
  }

  private handleDeleteError(error: unknown): never {
    if (isPrismaRecordNotFoundError(error)) {
      throw new Error("Shift not found");
    }

    throw error;
  }
}
