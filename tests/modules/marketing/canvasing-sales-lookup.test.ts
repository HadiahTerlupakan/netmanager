import { describe, expect, it, vi } from "vitest";

import {
  CanvasingSalesLookupRepository,
  kunciTelepon,
} from "@/modules/marketing/repositories/CanvasingSalesLookupRepository";

describe("kunciTelepon", () => {
  it("menyamakan awalan 0 / 62 / +62 dan pemisah ke 9 digit terakhir", () => {
    expect(kunciTelepon("0812-3456-7890")).toBe("234567890");
    expect(kunciTelepon("+62 812 3456 7890")).toBe("234567890");
    expect(kunciTelepon("6281234567890")).toBe("234567890");
  });

  it("nomor terlalu pendek tidak dipakai untuk pencocokan", () => {
    expect(kunciTelepon("12345")).toBeNull();
  });
});

describe("CanvasingSalesLookupRepository.cariSalesDariTelepon", () => {
  it("tidak menyentuh DB untuk nomor tak sah dan memetakan hasil query", async () => {
    const queryRaw = vi.fn(async () => [{ salesId: "s-ani" }]);
    const repo = new CanvasingSalesLookupRepository({ $queryRaw: queryRaw } as never);

    await expect(repo.cariSalesDariTelepon("t1", "12")).resolves.toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
    await expect(repo.cariSalesDariTelepon("t1", "0812-3456-7890")).resolves.toEqual(["s-ani"]);
  });
});
