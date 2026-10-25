import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import { buildLogoDataUri } from "@/modules/network/isolir/isolir-logo";

async function bigPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 800,
      height: 800,
      channels: 3,
      background: { r: 30, g: 90, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

async function sizeOf(dataUri: string) {
  const base64 = dataUri.slice("data:image/webp;base64,".length);
  return sharp(Buffer.from(base64, "base64")).metadata();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildLogoDataUri", () => {
  it("mengecilkan PNG 800x800 menjadi webp kecil dari URL", async () => {
    const png = await bigPng();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(new Uint8Array(png))),
    );

    const uri = await buildLogoDataUri("https://x.test/logo.png");

    expect(uri).toMatch(/^data:image\/webp;base64,/);
    expect(uri!.length).toBeLessThanOrEqual(8 * 1024);
    const meta = await sizeOf(uri!);
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(160);
  });

  it("membaca path lokal dari public/", async () => {
    const dir = path.join(process.cwd(), "public", "uploads-isolir-test");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "l.png"), await bigPng());
    try {
      const uri = await buildLogoDataUri("/uploads-isolir-test/l.png");
      expect(uri).toMatch(/^data:image\/webp;base64,/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("menolak path yang keluar dari public/", async () => {
    expect(await buildLogoDataUri("/../package.json")).toBeNull();
  });

  it("null, unduhan gagal, dan berkas bukan gambar menghasilkan null", async () => {
    expect(await buildLogoDataUri(null)).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await buildLogoDataUri("https://x.test/a.png")).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("bukan gambar")),
    );
    expect(await buildLogoDataUri("https://x.test/a.txt")).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 404 })),
    );
    expect(await buildLogoDataUri("https://x.test/404.png")).toBeNull();
  });
});
