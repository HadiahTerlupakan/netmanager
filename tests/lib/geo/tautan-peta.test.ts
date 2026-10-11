import { describe, expect, it } from "vitest";

import { uraikanTautanPeta } from "@/lib/geo/tautan-peta";

describe("uraikanTautanPeta", () => {
  it("membaca parameter q", () => {
    expect(
      uraikanTautanPeta("https://www.google.com/maps?q=-6.2,106.8"),
    ).toEqual({ status: "berhasil", latitude: -6.2, longitude: 106.8 });
  });

  it("membaca parameter query pada search api", () => {
    expect(
      uraikanTautanPeta(
        "https://www.google.com/maps/search/?api=1&query=-6.2,106.8",
      ),
    ).toEqual({ status: "berhasil", latitude: -6.2, longitude: 106.8 });
  });

  it("membaca koordinat kamera setelah @", () => {
    expect(
      uraikanTautanPeta("https://www.google.com/maps/@-6.2,106.8,17z"),
    ).toEqual({ status: "berhasil", latitude: -6.2, longitude: 106.8 });
  });

  it("mendahulukan koordinat tempat !3d!4d daripada posisi kamera @", () => {
    // @ adalah posisi kamera; !3d/!4d adalah titik tempatnya.
    expect(
      uraikanTautanPeta(
        "https://www.google.com/maps/place/Toko/@-6.1,106.7,17z/data=!3m1!4b1!3d-6.25!4d106.85",
      ),
    ).toEqual({ status: "berhasil", latitude: -6.25, longitude: 106.85 });
  });

  it("meminta resolusi untuk tautan pendek", () => {
    expect(uraikanTautanPeta("https://maps.app.goo.gl/abc123")).toEqual({
      status: "butuh_resolusi",
      url: "https://maps.app.goo.gl/abc123",
    });
  });

  it("meminta resolusi untuk goo.gl/maps", () => {
    expect(uraikanTautanPeta("https://goo.gl/maps/abc123").status).toBe(
      "butuh_resolusi",
    );
  });

  it("menolak koordinat di luar rentang", () => {
    expect(
      uraikanTautanPeta("https://www.google.com/maps?q=-91,200").status,
    ).toBe("gagal");
  });

  it("menolak titik nol derajat yang hampir selalu salah tempel", () => {
    expect(uraikanTautanPeta("https://www.google.com/maps?q=0,0").status).toBe(
      "gagal",
    );
  });

  it("menolak host di luar Google", () => {
    expect(
      uraikanTautanPeta("https://contoh.test/maps?q=-6.2,106.8").status,
    ).toBe("gagal");
  });

  it("menolak teks yang bukan URL", () => {
    expect(uraikanTautanPeta("bukan tautan").status).toBe("gagal");
  });

  it("menolak string kosong", () => {
    expect(uraikanTautanPeta("   ").status).toBe("gagal");
  });
});
