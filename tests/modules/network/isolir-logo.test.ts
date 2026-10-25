import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
const r2 = vi.hoisted(() => ({ getR2PublicBaseUrl: vi.fn() }));
vi.mock("@/lib/utils/r2-client", () => r2);

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

const R2_BASE = "https://cdn.example.test/media";

beforeEach(() => {
  r2.getR2PublicBaseUrl.mockResolvedValue(R2_BASE);
});

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

    const uri = await buildLogoDataUri(`${R2_BASE}/logo.png`);

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
    expect(await buildLogoDataUri(`${R2_BASE}/a.png`)).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("bukan gambar")),
    );
    expect(await buildLogoDataUri(`${R2_BASE}/a.txt`)).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 404 })),
    );
    expect(await buildLogoDataUri(`${R2_BASE}/404.png`)).toBeNull();
  });

  it("tidak mengunduh URL di luar penyimpanan R2 sendiri", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const url of [
      "http://127.0.0.1/logo.png",
      "http://169.254.169.254/latest",
      "https://cdn.example.test/mediaevil/logo.png",
    ]) {
      expect(await buildLogoDataUri(url)).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tanpa basis R2 terkonfigurasi, URL http mana pun ditolak", async () => {
    r2.getR2PublicBaseUrl.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await buildLogoDataUri(`${R2_BASE}/logo.png`)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mengunduh URL R2 tanpa mengikuti redirect", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array(await bigPng())));
    vi.stubGlobal("fetch", fetchMock);

    await buildLogoDataUri(`${R2_BASE}/logo.png`);

    expect(fetchMock).toHaveBeenCalledWith(
      `${R2_BASE}/logo.png`,
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("respons lebih dari 2 MiB menghasilkan null", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(new Uint8Array(2 * 1024 * 1024 + 1))),
    );
    expect(await buildLogoDataUri(`${R2_BASE}/big.png`)).toBeNull();
  });
});
