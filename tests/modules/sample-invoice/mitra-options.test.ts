import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn() }));

vi.mock("@/lib/prisma-mitra", () => ({
  prismaMitra: {
    mitra: { findMany: palsu.findMany, findFirst: palsu.findFirst },
  },
}));

import {
  findMitraOption,
  listMitraOptions,
} from "@/modules/sample-invoice/services/mitra-options";

describe("mitra untuk invoice contoh", () => {
  beforeEach(() => vi.clearAllMocks());

  // Form tidak boleh bergantung pada izin mitra:read, dan tidak dipotong 100.
  it("lists every mitra of the tenant, id and name only", async () => {
    palsu.findMany.mockResolvedValue([{ id: "m1", name: "Mitra A" }]);

    expect(await listMitraOptions()).toEqual([{ id: "m1", name: "Mitra A" }]);
    const args = palsu.findMany.mock.calls[0][0];
    expect(args.select).toEqual({ id: true, name: true });
    expect(args.take).toBeUndefined();
    expect(args.orderBy).toEqual({ name: "asc" });
  });

  it("finds a mitra by id through the tenant-isolated client", async () => {
    palsu.findFirst.mockResolvedValue(null);

    expect(await findMitraOption("other-tenant-mitra")).toBeNull();
    expect(palsu.findFirst).toHaveBeenCalledWith({
      where: { id: "other-tenant-mitra" },
      select: { id: true, name: true },
    });
  });
});
