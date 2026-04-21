import { describe, expect, it } from "vitest";

describe("inventory transfer helpers", () => {
  it("builds delete confirmation text without requiring barang relation", async () => {
    const helpers = (await import("@/lib/utils/inventory-helpers")) as Record<
      string,
      unknown
    >;
    const buildTransferDeleteConfirmMessage =
      helpers.buildTransferDeleteConfirmMessage as
        | ((transfer: {
            kodeTransfer: string;
            jumlah: number;
            barang?: { nama?: string | null; satuan?: string | null } | null;
          }) => string)
        | undefined;

    expect(buildTransferDeleteConfirmMessage).toBeTypeOf("function");
    expect(
      buildTransferDeleteConfirmMessage?.({
        kodeTransfer: "TRF-001",
        jumlah: 5,
      }),
    ).toContain("Barang: Unknown");
  });
});
