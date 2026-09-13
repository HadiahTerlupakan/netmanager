import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { trimLogoPadding } from "@/modules/settings/services/logo-trim";

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

describe("trimLogoPadding", () => {
  it("removes the empty frame around the artwork", async () => {
    const trimmed = await trimLogoPadding(await buildPaddedLogo());
    const meta = await sharp(
      Buffer.from(await trimmed.arrayBuffer()),
    ).metadata();

    expect(meta.width).toBe(MARK.width);
    expect(meta.height).toBe(MARK.height);
  });

  it("keeps the original file when the bytes are not an image", async () => {
    const broken = new File([new Uint8Array([1, 2, 3])], "logo.png", {
      type: "image/png",
    });

    const result = await trimLogoPadding(broken);

    expect(await result.arrayBuffer()).toEqual(await broken.arrayBuffer());
  });
});
