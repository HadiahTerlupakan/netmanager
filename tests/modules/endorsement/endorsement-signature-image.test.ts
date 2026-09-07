import { describe, expect, it } from "vitest";
import { parseSignatureDataUrl } from "@/modules/endorsement";

/**
 * Isi tanda tangan datang dari pihak luar tanpa akun, jadi bentuknya diperiksa
 * sebelum menyentuh penyimpanan. Awalan data URL bisa dipalsukan siapa pun —
 * yang menentukan adalah isi berkasnya.
 */

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const asDataUrl = (buffer: Buffer) =>
  `data:image/png;base64,${buffer.toString("base64")}`;

describe("parseSignatureDataUrl", () => {
  it("menerima PNG yang sah", () => {
    const png = Buffer.concat([PNG_MAGIC, Buffer.from("isi-gambar")]);

    expect(parseSignatureDataUrl(asDataUrl(png))).toEqual(png);
  });

  it("menolak awalan selain PNG", () => {
    expect(() => parseSignatureDataUrl("data:image/jpeg;base64,AAAA")).toThrow(
      /PNG/i,
    );
  });

  // Inti pemeriksaannya: berkas apa pun bisa diberi awalan PNG.
  it("menolak isi yang bukan PNG meski awalannya mengaku PNG", () => {
    const palsu = Buffer.from("%PDF-1.7 ini sebenarnya pdf");

    expect(() => parseSignatureDataUrl(asDataUrl(palsu))).toThrow(/bukan PNG/i);
  });

  it("menolak tanda tangan kosong", () => {
    expect(() => parseSignatureDataUrl("data:image/png;base64,")).toThrow(
      /kosong/i,
    );
  });

  it("menolak tanda tangan yang kelewat besar", () => {
    const besar = Buffer.concat([PNG_MAGIC, Buffer.alloc(400 * 1024, 1)]);

    expect(() => parseSignatureDataUrl(asDataUrl(besar))).toThrow(/besar/i);
  });
});
