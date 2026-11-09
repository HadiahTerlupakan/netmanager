import { describe, expect, it } from "vitest";

import {
  buildPurchaseLinkMessage,
  buildWhatsAppShareUrl,
  describePurchaseLinkInfo,
  resolveAbsoluteLinkUrl,
} from "@/app/admin/inventory/restock/restockPurchaseLink";

const URL_WITH_TOKEN = "https://contoh.test/belanja#abcDEF_-123";

describe("buildPurchaseLinkMessage", () => {
  it("menyusun pesan WhatsApp lengkap dengan peringatan", () => {
    expect(
      buildPurchaseLinkMessage({
        requestNumber: "PR-001",
        warehouseName: "Gudang Utama",
        url: URL_WITH_TOKEN,
      }),
    ).toBe(
      "Halo, ini daftar belanja untuk pengajuan PR-001 (Gudang Utama).\n" +
        "Buka link ini, centang barang yang sudah dibeli, isi nama Anda, lalu tanda tangan:\n" +
        `${URL_WITH_TOKEN}\n\nJangan teruskan link ini ke orang lain.`,
    );
  });
});

describe("buildWhatsAppShareUrl", () => {
  it("meng-encode teks, termasuk # supaya token tidak terpotong", () => {
    const shareUrl = buildWhatsAppShareUrl(`Buka ${URL_WITH_TOKEN}`);
    expect(shareUrl.startsWith("https://wa.me/?text=")).toBe(true);
    expect(shareUrl).toContain("%23abcDEF_-123");
    expect(shareUrl).not.toContain("#");
    expect(
      decodeURIComponent(shareUrl.slice("https://wa.me/?text=".length)),
    ).toBe(`Buka ${URL_WITH_TOKEN}`);
  });
});

describe("resolveAbsoluteLinkUrl", () => {
  it("melengkapi link relatif dengan alamat situs", () => {
    expect(resolveAbsoluteLinkUrl("/belanja#t", "https://situs.test/")).toBe(
      "https://situs.test/belanja#t",
    );
    expect(resolveAbsoluteLinkUrl("/belanja#t", "/")).toBe("/belanja#t");
  });

  it("membiarkan link yang sudah lengkap", () => {
    expect(resolveAbsoluteLinkUrl(URL_WITH_TOKEN, "https://lain.test")).toBe(
      URL_WITH_TOKEN,
    );
  });
});

describe("describePurchaseLinkInfo", () => {
  it("menyebut pembuat, masa berlaku, dan kapan terakhir dibuka", () => {
    const text = describePurchaseLinkInfo({
      createdAt: "2026-11-09T03:00:00.000Z",
      expiresAt: "2026-12-09T03:00:00.000Z",
      lastUsedAt: null,
      createdByName: "Budi",
    });
    expect(text).toMatch(
      /^Link dibuat 9 Nov 2026 oleh Budi, berlaku sampai 9 Des 2026\. Terakhir dibuka: belum pernah\.$/,
    );
  });
});
