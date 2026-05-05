import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";

import type { OvertimeEntity } from "../domain/entities/OvertimeEntity";
import type { IOvertimeRepository } from "../domain/ports/IOvertimeRepository";

/** Menangani lookup dan guard access untuk mutation overtime. */
export class OvertimeServiceAccess {
  constructor(private readonly repository: IOvertimeRepository) {}

  /** Pastikan user belum punya request overtime aktif pada hari yang sama. */
  async ensureNoActiveRequest(
    userId: string,
    tenantId: string | undefined,
    date: Date,
  ): Promise<void> {
    const existing = await this.repository.findActiveRequestByDate(
      userId,
      tenantId,
      toStartOfDay(new Date(date)),
      toEndOfDay(new Date(date)),
    );

    if (!existing) {
      return;
    }

    throw new Error(
      "Anda sudah memiliki pengajuan lembur aktif (Pending/Approved/Berjalan) untuk hari ini.",
    );
  }

  /** Ambil overtime berdasarkan ID atau lempar error bila tidak ada. */
  async requireOvertime(id: string): Promise<OvertimeEntity> {
    const overtime = await this.repository.findById(id);
    if (overtime) {
      return overtime;
    }

    throw new Error("Overtime request not found");
  }

  /** Ambil overtime milik user tertentu atau lempar error akses. */
  async requireOwnedOvertime(
    overtimeId: string,
    userId: string,
  ): Promise<OvertimeEntity> {
    const overtime = await this.requireOvertime(overtimeId);
    if (overtime.userId === userId) {
      return overtime;
    }

    throw new Error("Akses ditolak");
  }
}
