import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const mockGetLogoSettings = vi.hoisted(() => vi.fn());

vi.mock("@/modules/settings/services/logoSettings", () => ({
  getLogoSettings: (...args: unknown[]) => mockGetLogoSettings(...args),
}));

const REMOTE_URL = "https://cdn.example.test/logo-invoice.png";
const CANVAS = { width: 400, height: 300 };
const MARK = { width: 90, height: 24 };

async function buildPaddedPng(): Promise<Buffer> {
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

  return sharp({
    create: {
      width: CANVAS.width,
      height: CANVAS.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: mark, left: 150, top: 130 }])
    .png()
    .toBuffer();
}

describe("getTrimmedLogo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("serves the stored logo without its empty frame", async () => {
    // URL unik per test supaya tidak kena cache proses dari test lain.
    const url = `${REMOTE_URL}?case=trim`;
    mockGetLogoSettings.mockResolvedValue({
      logoInvoice: url,
      logoAplikasi: null,
      logoLandingPage: null,
    });
    const padded = await buildPaddedPng();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => padded.buffer.slice(0) as ArrayBuffer,
      }),
    );

    const { getTrimmedLogo } =
      await import("@/modules/settings/services/trimmedLogo");
    const result = await getTrimmedLogo("invoice");
    const meta = await sharp(result!.data).metadata();

    expect(meta.width).toBe(MARK.width);
    expect(meta.height).toBe(MARK.height);
    expect(result!.contentType).toBe("image/png");
  });

  it("returns null when no logo is configured", async () => {
    mockGetLogoSettings.mockResolvedValue({
      logoInvoice: null,
      logoAplikasi: null,
      logoLandingPage: null,
    });

    const { getTrimmedLogo } =
      await import("@/modules/settings/services/trimmedLogo");

    expect(await getTrimmedLogo("invoice")).toBeNull();
  });

  it("returns null when the source cannot be fetched, so callers can fall back", async () => {
    mockGetLogoSettings.mockResolvedValue({
      logoInvoice: `${REMOTE_URL}?case=gagal`,
      logoAplikasi: null,
      logoLandingPage: null,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const { getTrimmedLogo } =
      await import("@/modules/settings/services/trimmedLogo");

    expect(await getTrimmedLogo("invoice")).toBeNull();
  });
});
