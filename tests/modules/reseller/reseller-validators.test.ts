import { describe, expect, it } from "vitest";

import {
  createResellerSchema,
  listResellersQuerySchema,
  updateResellerSchema,
} from "@/modules/reseller/validators/reseller";
import {
  createResellerOutletSchema,
  updateResellerOutletSchema,
} from "@/modules/reseller/validators/reseller-outlet";
import { upsertResellerPackagePriceSchema } from "@/modules/reseller/validators/reseller-pricing";

describe("reseller validators — kolom opsional kosong dari form", () => {
  it("menerima email kosong saat membuat reseller dan menyimpannya sebagai null", () => {
    const result = createResellerSchema.safeParse({
      code: "RSL-1",
      name: "Reseller",
      email: "",
      phone: "  ",
      address: "",
      notes: "",
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      email: null,
      phone: null,
      address: null,
      notes: null,
    });
  });

  it("menerima email kosong saat mengedit reseller yang email-nya null", () => {
    const result = updateResellerSchema.safeParse({ name: "Baru", email: "" });

    expect(result.success).toBe(true);
    expect(result.data?.email).toBeNull();
  });

  it("tetap menolak email yang formatnya salah", () => {
    expect(
      createResellerSchema.safeParse({ code: "R", name: "A", email: "bukan" })
        .success,
    ).toBe(false);
  });

  it("membiarkan kolom yang tidak dikirim tetap undefined pada update", () => {
    const result = updateResellerSchema.safeParse({ name: "Baru" });

    expect(result.data).toEqual({ name: "Baru" });
  });

  it("mengubah phone/address outlet kosong menjadi null", () => {
    const result = updateResellerOutletSchema.safeParse({
      phone: "",
      address: " ",
    });

    expect(result.data).toEqual({ phone: null, address: null });
  });
});

describe("reseller validators — status saat create", () => {
  it("mempertahankan status INACTIVE yang dipilih saat membuat reseller", () => {
    const result = createResellerSchema.safeParse({
      code: "R",
      name: "A",
      status: "INACTIVE",
    });

    expect(result.data?.status).toBe("INACTIVE");
  });

  it("mempertahankan status INACTIVE yang dipilih saat membuat outlet", () => {
    const result = createResellerOutletSchema.safeParse({
      code: "O",
      name: "A",
      status: "INACTIVE",
    });

    expect(result.data?.status).toBe("INACTIVE");
  });

  it("menolak status di luar ACTIVE/INACTIVE", () => {
    expect(
      createResellerSchema.safeParse({ code: "R", name: "A", status: "X" })
        .success,
    ).toBe(false);
  });
});

describe("listResellersQuerySchema", () => {
  it("memberi default page 1 dan limit 20", () => {
    expect(listResellersQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it.each([
    [{ page: "abc" }],
    [{ limit: "abc" }],
    [{ page: "0" }],
    [{ limit: "201" }],
    [{ status: "DELETED" }],
  ])("menolak query tidak valid %j", (query) => {
    expect(listResellersQuerySchema.safeParse(query).success).toBe(false);
  });

  it("memperlakukan page/limit/status/search kosong sebagai tidak dikirim", () => {
    expect(
      listResellersQuerySchema.parse({
        page: "",
        limit: "",
        status: "",
        search: "  ",
      }),
    ).toEqual({ page: 1, limit: 20 });
  });

  it("menerima search, status, dan limit 200 untuk form PPP", () => {
    expect(
      listResellersQuerySchema.parse({
        page: "2",
        limit: "200",
        search: " budi ",
        status: "ACTIVE",
      }),
    ).toEqual({ page: 2, limit: 200, search: "budi", status: "ACTIVE" });
  });
});

describe("upsertResellerPackagePriceSchema", () => {
  it("menolak endsAt sebelum startsAt", () => {
    expect(
      upsertResellerPackagePriceSchema.safeParse({
        hargaPaketId: "pkg-1",
        price: 1000,
        startsAt: "2026-02-01",
        endsAt: "2026-01-01",
      }).success,
    ).toBe(false);
  });

  it("memperlakukan startsAt kosong sebagai tidak dikirim dan endsAt kosong sebagai null", () => {
    const parsed = upsertResellerPackagePriceSchema.parse({
      hargaPaketId: "pkg-1",
      price: 1000,
      startsAt: "",
      endsAt: "",
    });

    expect(parsed.startsAt).toBeUndefined();
    expect(parsed.endsAt).toBeNull();
  });

  it("tetap menolak tanggal yang tidak bisa dibaca", () => {
    expect(
      upsertResellerPackagePriceSchema.safeParse({
        hargaPaketId: "pkg-1",
        price: 1000,
        startsAt: "bukan-tanggal",
      }).success,
    ).toBe(false);
  });
});
