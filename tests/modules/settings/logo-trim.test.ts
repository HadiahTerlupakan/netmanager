import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { ValidationError } from "@/lib/errors";
import { toSafeLogoFile } from "@/modules/settings/services/logo-trim";

const CANVAS = { width: 400, height: 300 };
const MARK = { width: 80, height: 20 };

/** Bikin PNG dengan gambar kecil di tengah kanvas besar transparan. */
async function buildPaddedLogo(): Promise<File> {
  const mark = await sharp({
    create: {
      width: MARK.width,
      height: MARK.height,
      channels: 4,
      background: { r: 13, g: 148, b: 136, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const padded = await sharp({
    create: {
      width: CANVAS.width,
      height: CANVAS.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: mark, left: 160, top: 140 }])
    .png()
    .toBuffer();

  return new File([new Uint8Array(padded)], "logo.png", { type: "image/png" });
}

describe("toSafeLogoFile", () => {
  it("removes the empty frame around the artwork", async () => {
    const { file: trimmed } = await toSafeLogoFile(await buildPaddedLogo());
    const meta = await sharp(
      Buffer.from(await trimmed.arrayBuffer()),
    ).metadata();

    expect(meta.width).toBe(MARK.width);
    expect(meta.height).toBe(MARK.height);
  });

  it.each([
    ["HTML berlabel PNG", "<script>alert(1)</script>", "x.html", "image/png"],
    [
      "SVG berskrip",
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      "logo.svg",
      "image/svg+xml",
    ],
    ["byte rusak", "\u0001\u0002\u0003", "logo.png", "image/png"],
  ])("menolak %s", async (_label, body, name, type) => {
    const file = new File([body], name, { type });

    await expect(toSafeLogoFile(file)).rejects.toBeInstanceOf(ValidationError);
  });

  it("menentukan ekstensi dan tipe dari isi berkas, bukan dari klien", async () => {
    const jpeg = await sharp({
      create: { width: 40, height: 40, channels: 3, background: "#0d9488" },
    })
      .jpeg()
      .toBuffer();
    const file = new File([new Uint8Array(jpeg)], "logo.html", {
      type: "text/html",
    });

    const result = await toSafeLogoFile(file);

    expect(result.extension).toBe(".jpg");
    expect(result.file.type).toBe("image/jpeg");
    const meta = await sharp(
      Buffer.from(await result.file.arrayBuffer()),
    ).metadata();
    expect(meta.format).toBe("jpeg");
  });

  it("menolak gambar yang terlalu besar dimensinya", async () => {
    const huge = await sharp({
      create: { width: 5000, height: 10, channels: 3, background: "#000" },
    })
      .png()
      .toBuffer();
    const file = new File([new Uint8Array(huge)], "logo.png", {
      type: "image/png",
    });

    await expect(toSafeLogoFile(file)).rejects.toThrow("4096");
  });
});
