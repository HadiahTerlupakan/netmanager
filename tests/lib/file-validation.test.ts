import { describe, expect, it } from "vitest";

import { validateFileSignature } from "@/lib/utils/file-validation";

/**
 * Helper: bangun File mock dengan magic-bytes nyata di prefix, supaya
 * `file.slice(0, N).arrayBuffer()` mengembalikan signature yang valid.
 */
function fileWithBytes(bytes: number[], mime: string, name = "f"): File {
  const buffer = new Uint8Array(bytes);
  const blob = new Blob([buffer], { type: mime });
  const file = new File([blob], name, { type: mime });
  return file;
}

describe("validateFileSignature", () => {
  it("accepts a real JPEG (FF D8 FF)", async () => {
    const file = fileWithBytes([0xff, 0xd8, 0xff, 0xe0], "image/jpeg", "a.jpg");
    expect(await validateFileSignature(file, ["jpg"])).toBe(true);
  });

  it("accepts a real PNG (89 50 4E 47)", async () => {
    const file = fileWithBytes([0x89, 0x50, 0x4e, 0x47], "image/png", "a.png");
    expect(await validateFileSignature(file, ["png"])).toBe(true);
  });

  it("accepts a real GIF (47 49 46 38)", async () => {
    const file = fileWithBytes(
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
      "image/gif",
      "a.gif",
    );
    expect(await validateFileSignature(file, ["gif"])).toBe(true);
  });

  it("accepts a real WEBP (RIFF....WEBP)", async () => {
    // RIFF[0-3] + size[4-7] + WEBP[8-11]
    const file = fileWithBytes(
      [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
      "image/webp",
      "a.webp",
    );
    expect(await validateFileSignature(file, ["webp"])).toBe(true);
  });

  it("rejects a file whose content does not match its claimed type", async () => {
    // Client claims image/jpeg, but bytes are PNG signature — must reject.
    const file = fileWithBytes(
      [0x89, 0x50, 0x4e, 0x47],
      "image/jpeg",
      "fake.jpg",
    );
    expect(await validateFileSignature(file, ["jpg"])).toBe(false);
  });

  it("rejects a non-image buffer (e.g. EXE) regardless of claimed MIME", async () => {
    // MZ header (Windows PE) — never a valid image signature.
    const file = fileWithBytes(
      [0x4d, 0x5a, 0x90, 0x00],
      "image/jpeg",
      "malware.exe",
    );
    expect(
      await validateFileSignature(file, ["jpg", "png", "webp", "gif"]),
    ).toBe(false);
  });

  it("returns false when allowedTypes is empty", async () => {
    const file = fileWithBytes([0xff, 0xd8, 0xff], "image/jpeg");
    expect(await validateFileSignature(file, [])).toBe(false);
  });
});
