import { describe, expect, it } from "vitest";

import { decodePngSignatureDataUrl } from "@/lib/signature/png-signature";

import { buildPng, pngChunk } from "../../helpers/png-fixture";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const STRICT = { maxBytes: 200 * 1024, maxWidth: 4096, maxHeight: 1024 };

function png(width: number, height: number, padding = 32): Buffer {
  return buildPng({ width, height, idatBytes: padding });
}

const asDataUrl = (buffer: Buffer) =>
  `data:image/png;base64,${buffer.toString("base64")}`;

describe("decodePngSignatureDataUrl", () => {
  it("menerima PNG sah dan membaca dimensinya", () => {
    const result = decodePngSignatureDataUrl(asDataUrl(png(800, 300)), STRICT);

    expect(result).toMatchObject({ ok: true, width: 800, height: 300 });
  });

  it("menolak awalan selain PNG", () => {
    expect(
      decodePngSignatureDataUrl("data:image/jpeg;base64,AAAA", STRICT),
    ).toEqual({ ok: false, reason: "NOT_PNG" });
  });

  it("menolak base64 kosong", () => {
    expect(decodePngSignatureDataUrl("data:image/png;base64,", STRICT)).toEqual(
      { ok: false, reason: "EMPTY" },
    );
  });

  it("menolak base64 yang tidak bersih", () => {
    expect(
      decodePngSignatureDataUrl("data:image/png;base64,<svg>", STRICT),
    ).toEqual({ ok: false, reason: "NOT_PNG" });
  });

  it("menolak isi bukan PNG meski awalannya mengaku PNG", () => {
    const palsu = Buffer.from(
      "<svg onload=alert(1)></svg> dan seterusnya.....",
    );
    expect(decodePngSignatureDataUrl(asDataUrl(palsu), STRICT)).toEqual({
      ok: false,
      reason: "NOT_PNG",
    });
  });

  it("menolak PNG tanpa chunk IHDR", () => {
    const tanpaIhdr = Buffer.concat([PNG_MAGIC, Buffer.alloc(40, 1)]);
    expect(decodePngSignatureDataUrl(asDataUrl(tanpaIhdr), STRICT)).toEqual({
      ok: false,
      reason: "NOT_PNG",
    });
  });

  it.each([
    [5000, 300],
    [800, 2000],
    [0, 300],
  ])("menolak dimensi %ix%i", (width, height) => {
    expect(
      decodePngSignatureDataUrl(asDataUrl(png(width, height)), STRICT),
    ).toEqual({ ok: false, reason: "BAD_DIMENSIONS" });
  });

  it("menolak berkas di atas 200 KB", () => {
    const besar = png(800, 300, 201 * 1024);
    expect(decodePngSignatureDataUrl(asDataUrl(besar), STRICT)).toEqual({
      ok: false,
      reason: "TOO_LARGE",
    });
  });

  it.each([
    ["bit depth 16", { bitDepth: 16 }],
    ["bit depth 1", { bitDepth: 1 }],
    ["palet (color type 3)", { colorType: 3 }],
    ["abu-abu (color type 0)", { colorType: 0 }],
    ["interlace Adam7", { interlace: 1 }],
  ])("menolak format %s", (_label, options) => {
    expect(
      decodePngSignatureDataUrl(asDataUrl(buildPng(options)), STRICT),
    ).toEqual({ ok: false, reason: "NOT_PNG" });
  });

  it("menerima RGB 8 bit (color type 2)", () => {
    expect(
      decodePngSignatureDataUrl(asDataUrl(buildPng({ colorType: 2 })), STRICT),
    ).toMatchObject({ ok: true });
  });

  it("menolak data titipan setelah IEND", () => {
    const titipan = buildPng({ trailing: Buffer.from("<script>") });
    expect(decodePngSignatureDataUrl(asDataUrl(titipan), STRICT)).toEqual({
      ok: false,
      reason: "NOT_PNG",
    });
  });

  it("menolak chunk tambahan setelah IEND", () => {
    const berlebih = buildPng({ isChunkAfterEnd: true });
    expect(decodePngSignatureDataUrl(asDataUrl(berlebih), STRICT)).toEqual({
      ok: false,
      reason: "NOT_PNG",
    });
  });

  it("menolak PNG tanpa IEND (terpotong)", () => {
    const utuh = buildPng();
    const terpotong = utuh.subarray(0, utuh.byteLength - 12);
    expect(decodePngSignatureDataUrl(asDataUrl(terpotong), STRICT)).toEqual({
      ok: false,
      reason: "NOT_PNG",
    });
  });

  it("menolak chunk yang panjangnya melewati akhir berkas", () => {
    const rusak = Buffer.concat([
      buildPng().subarray(0, 33),
      Buffer.from([0xff, 0xff, 0xff, 0xff]),
      Buffer.from("IDAT", "latin1"),
    ]);
    expect(decodePngSignatureDataUrl(asDataUrl(rusak), STRICT)).toEqual({
      ok: false,
      reason: "NOT_PNG",
    });
  });

  it("menolak PNG tanpa data gambar (IDAT)", () => {
    const ihdr = buildPng().subarray(8, 33);
    const tanpaIdat = Buffer.concat([PNG_MAGIC, ihdr, pngChunk("IEND")]);
    expect(decodePngSignatureDataUrl(asDataUrl(tanpaIdat), STRICT)).toEqual({
      ok: false,
      reason: "NOT_PNG",
    });
  });

  it("tanpa batas dimensi hanya memeriksa magic bytes (perilaku pengesahan)", () => {
    const tanpaIhdr = Buffer.concat([PNG_MAGIC, Buffer.from("isi-gambar")]);
    expect(
      decodePngSignatureDataUrl(asDataUrl(tanpaIhdr), { maxBytes: 1024 }),
    ).toMatchObject({ ok: true });
  });
});
