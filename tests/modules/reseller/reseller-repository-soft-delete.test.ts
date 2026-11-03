import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ResellerRepository } from "@/modules/reseller/repositories/ResellerRepository";

function createDb(status: string) {
  return {
    reseller: {
      findFirst: vi.fn().mockResolvedValue({ id: "reseller-1", status }),
      update: vi.fn(),
    },
  };
}

describe("ResellerRepository.softDelete", () => {
  it("mencatat waktu perubahan status agar komisi pembayaran sebelumnya tetap terakru", async () => {
    const db = createDb("ACTIVE");

    await new ResellerRepository(db as unknown as PrismaClient).softDelete(
      "tenant-1",
      "reseller-1",
    );

    const { data } = db.reseller.update.mock.calls[0][0];
    expect(data.status).toBe("INACTIVE");
    expect(data.statusChangedAt).toBeInstanceOf(Date);
    expect(data.statusChangedAt).toEqual(data.deletedAt);
  });

  it("tidak menimpa waktu perubahan bila reseller sudah INACTIVE", async () => {
    const db = createDb("INACTIVE");

    await new ResellerRepository(db as unknown as PrismaClient).softDelete(
      "tenant-1",
      "reseller-1",
    );

    expect(db.reseller.update.mock.calls[0][0].data).not.toHaveProperty(
      "statusChangedAt",
    );
  });
});
