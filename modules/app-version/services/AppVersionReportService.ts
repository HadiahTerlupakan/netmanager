import { prisma, prismaMitra } from "@/modules/database";

import { AppVersionValidationError } from "../errors";

export interface MobileVersionReportInput {
  sessionUserId: string;
  tenantId?: string | null;
  role?: string | null;
  versionCode: unknown;
  versionName?: string | null;
}

export class AppVersionReportService {
  /** Menyimpan laporan versi aplikasi dari mobile user sesuai tipe aktor. */
  async reportMobileVersion(
    input: MobileVersionReportInput,
  ): Promise<{ success: true }> {
    const parsedVersionCode = this.parseMobileVersionCode(input.versionCode);
    if (parsedVersionCode === null) {
      throw new AppVersionValidationError(
        "versionCode harus berupa angka bulat positif",
      );
    }

    await this.updateVersionOwner({
      sessionUserId: input.sessionUserId,
      tenantId: input.tenantId ?? null,
      role: input.role ?? null,
      versionCode: parsedVersionCode,
      versionName: input.versionName ?? null,
    });
    return { success: true };
  }

  private parseMobileVersionCode(value: unknown): number | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const normalizedValue = String(value).trim();
    if (!/^\d+$/.test(normalizedValue)) return null;
    const parsedValue = Number(normalizedValue);
    return Number.isInteger(parsedValue) && parsedValue > 0
      ? parsedValue
      : null;
  }

  private async updateVersionOwner(input: {
    sessionUserId: string;
    tenantId: string | null;
    role: string | null;
    versionCode: number;
    versionName: string | null;
  }) {
    const versionPayload = this.buildVersionUpdatePayload(
      input.versionCode,
      input.versionName,
    );

    if (input.role === "CUSTOMER") {
      await prisma.pelanggan.update({
        where: {
          id: input.sessionUserId,
          tenantId: input.tenantId ?? undefined,
        },
        data: versionPayload,
      });
      return;
    }

    if (input.role === "MITRA") {
      await prismaMitra.mitra.update({
        where: { id: input.sessionUserId },
        data: versionPayload,
      });
      return;
    }

    await prisma.user.update({
      where: { id: input.sessionUserId, tenantId: input.tenantId ?? undefined },
      data: versionPayload,
    });
  }

  private buildVersionUpdatePayload(
    versionCode: number,
    versionName: string | null,
  ) {
    return {
      lastVersionCode: versionCode,
      lastVersionName: versionName,
      lastVersionUpdate: new Date(),
    };
  }
}
