import { describe, expect, it, vi } from "vitest";

import { getPppConnectionMode } from "@/modules/settings";
import type { ISettingsRepository } from "@/modules/settings/domain/ports/ISettingsRepository";

function createRepository(value: string | null): ISettingsRepository {
  return {
    findManyByKeys: vi
      .fn()
      .mockResolvedValue(
        value === null
          ? []
          : [{ key: "PPP_CONNECTION_MODE", value, encrypted: false }],
      ),
    upsertMany: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    deleteManyByKeys: vi.fn(),
  };
}

describe("getPppConnectionMode", () => {
  it("mengambil mode koneksi PPP dari settings repository", async () => {
    const repository = createRepository("MIKROTIK_API");

    const result = await getPppConnectionMode(repository);

    expect(repository.findManyByKeys).toHaveBeenCalledWith([
      "PPP_CONNECTION_MODE",
    ]);
    expect(result).toBe("MIKROTIK_API");
  });

  it("mengembalikan null ketika setting belum ada", async () => {
    const repository = createRepository(null);

    const result = await getPppConnectionMode(repository);

    expect(result).toBeNull();
  });
});
