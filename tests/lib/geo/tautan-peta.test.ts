import { describe, expect, it } from "vitest";

import { HOST_PETA_DIIZINKAN, uraikanTautanPeta } from "@/lib/geo/tautan-peta";

describe("uraikanTautanPeta", () => {
  describe("membaca koordinat", () => {
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

    it("mengambil pasangan !3d!4d pertama bila tautan rute memuat beberapa", () => {
      expect(
        uraikanTautanPeta(
          "https://www.google.com/maps/dir/!3d-6.2!4d106.8/data=!3d-6.5!4d106.9",
        ),
      ).toEqual({ status: "berhasil", latitude: -6.2, longitude: 106.8 });
    });
  });

  describe("tautan pendek", () => {
    it("meminta resolusi untuk tautan pendek dan mengembalikan url ternormalisasi", () => {
      expect(uraikanTautanPeta("https://maps.app.goo.gl/abc123")).toEqual({
        status: "butuh_resolusi",
        url: "https://maps.app.goo.gl/abc123",
      });
    });

    it("menormalisasi url hasil, bukan teks mentah yang ditempel", () => {
      expect(
        uraikanTautanPeta("  https://MAPS.APP.GOO.GL/abc123?x=1  "),
      ).toEqual({
        status: "butuh_resolusi",
        url: "https://maps.app.goo.gl/abc123?x=1",
      });
    });

    it("meminta resolusi untuk goo.gl/maps", () => {
      expect(uraikanTautanPeta("https://goo.gl/maps/abc123").status).toBe(
        "butuh_resolusi",
      );
    });

    it("menolak goo.gl yang path-nya bukan /maps", () => {
      expect(uraikanTautanPeta("https://goo.gl/apa-saja").status).toBe("gagal");
    });

    it("menolak goo.gl dengan path yang hanya diawali kata maps", () => {
      expect(uraikanTautanPeta("https://goo.gl/mapsku").status).toBe("gagal");
    });
  });

  describe("validasi koordinat", () => {
    it("menolak koordinat di luar rentang", () => {
      expect(
        uraikanTautanPeta("https://www.google.com/maps?q=-91,200").status,
      ).toBe("gagal");
    });

    it("menolak pasangan nol-nol yang hampir selalu salah tempel", () => {
      expect(
        uraikanTautanPeta("https://www.google.com/maps?q=0,0").status,
      ).toBe("gagal");
    });

    it("menerima lintang nol selama bujur tidak nol (khatulistiwa)", () => {
      expect(
        uraikanTautanPeta("https://www.google.com/maps?q=0,106.8"),
      ).toEqual({ status: "berhasil", latitude: 0, longitude: 106.8 });
    });

    it("menerima bujur nol selama lintang tidak nol (meridian)", () => {
      expect(uraikanTautanPeta("https://www.google.com/maps?q=-6.2,0")).toEqual(
        {
          status: "berhasil",
          latitude: -6.2,
          longitude: 0,
        },
      );
    });

    it("tidak mengganti hasil gagal !3d dengan @ yang valid", () => {
      expect(
        uraikanTautanPeta(
          "https://www.google.com/maps/place/Toko/@-6.1,106.7,17z/data=!3d-95!4d106.85",
        ).status,
      ).toBe("gagal");
    });
  });

  describe("validasi host", () => {
    it("menolak host di luar Google", () => {
      expect(
        uraikanTautanPeta("https://contoh.test/maps?q=-6.2,106.8").status,
      ).toBe("gagal");
    });

    it("menolak host yang hanya diawali nama Google", () => {
      expect(
        uraikanTautanPeta("https://google.com.penyerang.test/maps?q=-6.2,106.8")
          .status,
      ).toBe("gagal");
    });

    it("menolak host yang hanya berakhiran nama Google", () => {
      expect(
        uraikanTautanPeta("https://evil-google.com/maps?q=-6.2,106.8").status,
      ).toBe("gagal");
    });

    it("menolak kredensial yang menyamarkan host asli", () => {
      expect(
        uraikanTautanPeta("https://google.com@evil.test/maps?q=-6.2,106.8")
          .status,
      ).toBe("gagal");
    });

    it("menerima domain Google Indonesia yang didaftarkan satu per satu", () => {
      expect(
        uraikanTautanPeta("https://google.co.id/maps?q=-6.2,106.8").status,
      ).toBe("berhasil");
      expect(
        uraikanTautanPeta("https://www.google.co.id/maps?q=-6.2,106.8").status,
      ).toBe("berhasil");
      expect(
        uraikanTautanPeta("https://maps.google.co.id/?q=-6.2,106.8").status,
      ).toBe("berhasil");
    });

    it("menolak subdomain sembarang di bawah google.co.id", () => {
      expect(
        uraikanTautanPeta("https://acak.google.co.id/maps?q=-6.2,106.8").status,
      ).toBe("gagal");
    });

    it("menjaga daftar izin tetap beku saat runtime", () => {
      expect(Object.isFrozen(HOST_PETA_DIIZINKAN)).toBe(true);
    });
  });

  describe("validasi protokol, kredensial, dan port", () => {
    it("menolak protokol selain https pada tautan pendek", () => {
      expect(uraikanTautanPeta("http://goo.gl/maps/abc123").status).toBe(
        "gagal",
      );
      expect(uraikanTautanPeta("ftp://goo.gl/maps/abc123").status).toBe(
        "gagal",
      );
    });

    it("menolak protokol selain https pada tautan koordinat", () => {
      expect(
        uraikanTautanPeta("file://google.com/maps?q=-6.2,106.8").status,
      ).toBe("gagal");
      expect(
        uraikanTautanPeta("http://www.google.com/maps?q=-6.2,106.8").status,
      ).toBe("gagal");
    });

    it("menolak tautan dengan username", () => {
      expect(
        uraikanTautanPeta("https://u@www.google.com/maps?q=-6.2,106.8").status,
      ).toBe("gagal");
    });

    it("menolak tautan dengan username dan password", () => {
      expect(uraikanTautanPeta("https://u:p@goo.gl/maps/abc123").status).toBe(
        "gagal",
      );
    });

    it("menolak port non-default pada tautan pendek", () => {
      expect(uraikanTautanPeta("https://goo.gl:8080/maps/abc123").status).toBe(
        "gagal",
      );
    });

    it("menolak port non-default pada tautan koordinat", () => {
      expect(
        uraikanTautanPeta("https://www.google.com:8443/maps?q=-6.2,106.8")
          .status,
      ).toBe("gagal");
    });

    it("menerima port default https yang eksplisit", () => {
      expect(
        uraikanTautanPeta("https://www.google.com:443/maps?q=-6.2,106.8")
          .status,
      ).toBe("berhasil");
    });
  });

  describe("input tidak valid", () => {
    it("menolak teks yang bukan URL", () => {
      expect(uraikanTautanPeta("bukan tautan").status).toBe("gagal");
    });

    it("menolak string kosong", () => {
      expect(uraikanTautanPeta("   ").status).toBe("gagal");
    });
  });
});
