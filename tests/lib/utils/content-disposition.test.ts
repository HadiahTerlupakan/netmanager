import { describe, expect, it } from "vitest";
import { buildContentDisposition } from "@/lib/utils/content-disposition";

/**
 * Nilai header HTTP hanya boleh Latin-1. Nama berkas unggahan dengan karakter
 * lain dulu membuat `new NextResponse` melempar galat sehingga unduhan 500.
 */
describe("buildContentDisposition", () => {
  it("menghasilkan header yang bisa dipasang untuk nama non-ASCII", () => {
    const header = buildContentDisposition("Surat—Final 李.pdf");

    expect(() => new Headers({ "content-disposition": header })).not.toThrow();
    expect(header).toContain("filename*=UTF-8''Surat%E2%80%94Final%20%E6%9D%8E.pdf");
  });

  it("menetralkan tanda kutip agar tidak memecah header", () => {
    const header = buildContentDisposition('a"b.pdf');

    expect(header).toMatch(/^inline; filename="a_b\.pdf";/);
  });

  it("mendukung disposisi attachment", () => {
    expect(buildContentDisposition("x.pdf", "attachment")).toMatch(
      /^attachment; /,
    );
  });
});
