import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMitra: vi.fn() }));

vi.mock("@/lib/prisma-mitra", () => ({
  prismaMitraAuth: { mitra: { findUnique: mocks.findMitra } },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
  prismaAuth: { pelanggan: { findUnique: vi.fn() } },
}));

import { ActorSummaryLookup } from "@/modules/chat/services/actor-resolver";

describe("ActorSummaryLookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMitra.mockResolvedValue({
      id: "mitra-1",
      name: "Mitra Satu",
      fotoDiri: null,
    });
  });

  it("satu mitra yang mengirim banyak pesan hanya dicari sekali (dulu 1 query per pesan)", async () => {
    const lookup = new ActorSummaryLookup();

    const hasil = await Promise.all(
      Array.from({ length: 50 }, () =>
        lookup.find({ type: "mitra", id: "mitra-1" }),
      ),
    );

    expect(mocks.findMitra).toHaveBeenCalledTimes(1);
    expect(hasil.every((ringkasan) => ringkasan?.name === "Mitra Satu")).toBe(
      true,
    );
  });
});
