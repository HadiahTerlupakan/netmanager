import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { convertAndSaveImage } from "@/lib/utils/image-upload";

describe("convertAndSaveImage", () => {
  it("preserves fully transparent pixels without leftover white halo color", async () => {
    const svg = `
      <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" fill="transparent"/>
        <circle cx="32" cy="32" r="20" fill="#2563eb"/>
      </svg>
    `;

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const file = new File([new Uint8Array(pngBuffer)], "logo.png", {
      type: "image/png",
    });
    const savedPath = await convertAndSaveImage(
      file,
      "public/uploads/test-logos",
      "transparent-logo-test",
      "logos",
    );
    const outputPath = path.join(
      process.cwd(),
      "public",
      savedPath.replace(/^\//, ""),
    );

    const outputBuffer = await sharp(outputPath).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });

    const x = 11;
    const y = 32;
    const index =
      (y * outputBuffer.info.width + x) * outputBuffer.info.channels;

    expect(outputBuffer.data[index + 3]).toBe(0);
    expect(outputBuffer.data[index]).toBe(0);
    expect(outputBuffer.data[index + 1]).toBe(0);
    expect(outputBuffer.data[index + 2]).toBe(0);
  });
});
