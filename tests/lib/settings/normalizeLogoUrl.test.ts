import { describe, expect, it } from "vitest";

import { normalizeLogoUrl } from "@/lib/settings/normalizeLogoUrl";

describe("normalizeLogoUrl", () => {
  it("mengembalikan URL remote apa adanya", () => {
    expect(normalizeLogoUrl("https://cdn.example.com/logo.png")).toBe(
      "https://cdn.example.com/logo.png",
    );
  });

  it("menambahkan leading slash untuk path lokal relatif", () => {
    expect(normalizeLogoUrl("uploads/logos/logo-invoice.png")).toBe(
      "/uploads/logos/logo-invoice.png",
    );
  });

  it("mempertahankan path lokal yang sudah absolut", () => {
    expect(normalizeLogoUrl("/uploads/logos/logo-invoice.png")).toBe(
      "/uploads/logos/logo-invoice.png",
    );
  });

  it("mengembalikan null untuk nilai kosong", () => {
    expect(normalizeLogoUrl("   ")).toBeNull();
  });
});
