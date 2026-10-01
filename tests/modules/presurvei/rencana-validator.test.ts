import { describe, expect, it } from "vitest";
import { buatRencanaSchema, ubahRencanaSchema } from "@/modules/presurvei";

const DASAR = { tanggal: "2026-09-27", tujuan: "Kunjungi Pak Budi" };

describe("jam rencana", () => {
  it("jam opsional; format HH:mm 24 jam", () => {
    expect(buatRencanaSchema.parse(DASAR).jam).toBeUndefined();
    expect(buatRencanaSchema.parse({ ...DASAR, jam: "09:30" }).jam).toBe("09:30");
    expect(buatRencanaSchema.parse({ ...DASAR, jam: "23:59" }).jam).toBe("23:59");
  });

  it.each(["25:00", "9:30", "09:60", "jam 9"])("menolak jam %s", (jam) => {
    expect(buatRencanaSchema.safeParse({ ...DASAR, jam }).success).toBe(false);
  });

  it("jam kosong berarti tanpa jam (null), untuk menghapus jam saat ubah", () => {
    expect(buatRencanaSchema.parse({ ...DASAR, jam: "" }).jam).toBeNull();
    expect(ubahRencanaSchema.parse({ jam: "" })).toEqual({ jam: null });
  });

  it("ubah tanpa jam tidak menyelipkan kunci jam, dan masukan kosong tetap ditolak", () => {
    expect(Object.keys(ubahRencanaSchema.parse({ tujuan: "Baru" }))).toEqual(["tujuan"]);
    expect(ubahRencanaSchema.safeParse({}).success).toBe(false);
  });
});

describe("daftar rencana", () => {
  it("agenda tim besar muat satu halaman (limit sampai 300), di atasnya ditolak", async () => {
    const { daftarRencanaSchema } = await import("@/modules/presurvei");
    expect(daftarRencanaSchema.parse({ limit: "300" }).limit).toBe(300);
    expect(daftarRencanaSchema.safeParse({ limit: "301" }).success).toBe(false);
  });
});
