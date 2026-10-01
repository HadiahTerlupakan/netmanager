import { describe, expect, it } from "vitest";

import {
  kepalaSalesIdUntukDikirim,
  opsiKepalaSales,
} from "@/app/admin/users/lib/kepalaSales";

const KANDIDAT = [
  { id: "k-1", nama: "Rina" },
  { id: "k-2", nama: "Budi" },
];

describe("opsiKepalaSales", () => {
  it("membuang user yang sedang diubah dari pilihan", () => {
    expect(opsiKepalaSales(KANDIDAT, "k-1", null)).toEqual([
      { id: "k-2", nama: "Budi" },
    ]);
  });

  it("form tambah user menawarkan semua kandidat", () => {
    expect(opsiKepalaSales(KANDIDAT, null, null)).toEqual(KANDIDAT);
  });

  it("kepala sales tersimpan yang bukan kandidat lagi tetap ditawarkan", () => {
    const opsi = opsiKepalaSales(KANDIDAT, "u-9", {
      id: "k-lama",
      nama: "Joko",
    });
    expect(opsi.at(-1)).toEqual({
      id: "k-lama",
      nama: "Joko (bukan kandidat lagi)",
    });
  });

  it("kepala sales tersimpan yang masih kandidat tidak diduplikasi", () => {
    expect(
      opsiKepalaSales(KANDIDAT, "u-9", { id: "k-2", nama: "Budi" }),
    ).toHaveLength(2);
  });
});

describe("kepalaSalesIdUntukDikirim", () => {
  it("mengirim id terpilih untuk user sales", () => {
    expect(kepalaSalesIdUntukDikirim(true, "k-1")).toBe("k-1");
  });

  it("opsi kosong dan user non-sales dikirim sebagai null (lepas tim)", () => {
    expect(kepalaSalesIdUntukDikirim(true, "")).toBeNull();
    expect(kepalaSalesIdUntukDikirim(false, "k-1")).toBeNull();
  });
});
