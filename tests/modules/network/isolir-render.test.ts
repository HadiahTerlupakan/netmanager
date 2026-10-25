import { describe, expect, it } from "vitest";
import {
  ROUTER_PAGE_MAX_BYTES,
  renderIsolirPage,
} from "@/modules/network/isolir/isolir-render";
import type { IsolirContent } from "@/modules/network/isolir/isolir-page.types";

const baseContent = (over: Partial<IsolirContent> = {}): IsolirContent => ({
  ispName: "Net Cepat",
  title: "Layanan Anda Diisolir",
  message: "Silakan bayar tagihan.",
  logoDataUri: null,
  payments: [
    { label: "BCA", number: "1234567890", holder: "PT Net Cepat" },
    { label: "Mandiri", number: "9876543210", holder: "PT Net Cepat" },
  ],
  whatsapp: { number: "628123456789", text: "Halo admin & tim" },
  link: { label: "Portal Pelanggan", url: "https://portal.example.com/bayar" },
  contactText: "Hubungi 0812-3456-789",
  primaryColor: "#0f766e",
  ...over,
});

describe("renderIsolirPage", () => {
  it("menampilkan semua bagian", () => {
    const { html } = renderIsolirPage(baseContent());
    for (const s of [
      "Layanan Anda Diisolir",
      "Net Cepat",
      "Silakan bayar tagihan.",
      "BCA",
      "1234567890",
      "9876543210",
      "PT Net Cepat",
      "wa.me/628123456789",
      encodeURIComponent("Halo admin & tim"),
      "Portal Pelanggan",
      "https://portal.example.com/bayar",
      "Hubungi 0812-3456-789",
      "#0f766e",
      '<meta name="viewport"',
    ]) {
      expect(html).toContain(s);
    }
  });

  it("tanpa script dan aset luar", () => {
    const { html } = renderIsolirPage(
      baseContent({ logoDataUri: "data:image/webp;base64,AAAA" }),
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain('src="http');
    expect(html).toContain('src="data:image/webp;base64,AAAA"');
    const hrefs = [...html.matchAll(/<(\w+)[^>]*href="http[^"]*"/g)].map(
      (m) => m[1],
    );
    expect(hrefs.every((tag) => tag === "a")).toBe(true);
    expect(html).not.toMatch(/<link\b/);
  });

  it("escape", () => {
    const { html } = renderIsolirPage(
      baseContent({ message: '<script>alert(1)</script> "x" $(user)' }),
    );
    expect(html).toContain(
      "&lt;script&gt;alert(1)&lt;/script&gt; &quot;x&quot; &#36;(user)",
    );
    expect(html).not.toContain("$(");
    expect(html).not.toContain("<script");
  });

  it("menulis $ di semua field tenant sebagai entitas", () => {
    const { html } = renderIsolirPage(
      baseContent({
        ispName: "$(a)",
        title: "$(b)",
        payments: [{ label: "$(c)", number: "$(d)", holder: "$(e)" }],
        link: { label: "$(f)", url: "https://x.example/$(g)" },
        contactText: "$(h)",
      }),
    );
    expect(html).not.toContain("$(");
  });

  it("tidak merender link bukan http(s)", () => {
    const { html } = renderIsolirPage(
      baseContent({ link: { label: "Klik", url: "javascript:alert(1)" } }),
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("Klik");
  });

  it("escape nilai atribut href", () => {
    const { html } = renderIsolirPage(
      baseContent({
        link: { label: "L", url: 'https://x.example/?a="b"&c=<d>' },
      }),
    );
    expect(html).toContain(
      'href="https://x.example/?a=&quot;b&quot;&amp;c=&lt;d&gt;"',
    );
  });

  it("baris baru menjadi <br>", () => {
    const { html } = renderIsolirPage(baseContent({ message: "a\nb\r\nc" }));
    expect(html).toContain("a<br>b<br>c");
  });

  it("terlalu besar: logo dibuang dulu", () => {
    const logo =
      "data:image/webp;base64," + Buffer.alloc(20 * 1024).toString("base64");
    const { html, dropped } = renderIsolirPage(
      baseContent({ logoDataUri: logo, message: "pendek" }),
    );
    expect(dropped).toEqual(["logo"]);
    expect(html).not.toContain("data:image");
    expect(Buffer.byteLength(html)).toBeLessThanOrEqual(ROUTER_PAGE_MAX_BYTES);
  });

  it("terlalu besar: pesan dipotong", () => {
    const { html, dropped } = renderIsolirPage(
      baseContent({ message: "x".repeat(40 * 1024) }),
    );
    expect(dropped).toContain("message");
    expect(html).toMatch(/x…</);
    expect(Buffer.byteLength(html)).toBeLessThanOrEqual(ROUTER_PAGE_MAX_BYTES);
  });

  it("pesan penuh karakter yang di-escape tetap muat", () => {
    const { html } = renderIsolirPage(
      baseContent({ message: "$".repeat(40 * 1024) }),
    );
    expect(Buffer.byteLength(html)).toBeLessThanOrEqual(ROUTER_PAGE_MAX_BYTES);
  });

  it("hash stabil", () => {
    const a = renderIsolirPage(baseContent());
    const b = renderIsolirPage(baseContent());
    const c = renderIsolirPage(baseContent({ message: "lain" }));
    expect(a.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(a.hash).toBe(b.hash);
    expect(a.hash).not.toBe(c.hash);
  });
});
