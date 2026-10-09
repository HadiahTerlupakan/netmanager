import { describe, expect, it } from "vitest";

import {
  isPublicUploadPath,
  kanonikJalurUpload,
  sanitizeUploadFolder,
  tenantDariDirektoriUpload,
  tenantJalurUpload,
  validateUploadFile,
} from "@/lib/upload/upload-policy";

describe("upload policy", () => {
  it("rejects unknown folder", () => {
    const result = sanitizeUploadFolder("evil-folder");
    expect(result.ok).toBe(false);
  });

  it("accepts invoice pdf under size limit", () => {
    const result = validateUploadFile({
      folder: "invoices",
      mimeType: "application/pdf",
      size: 1024 * 1024,
      fileName: "invoice-001.pdf",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects oversize file", () => {
    const result = validateUploadFile({
      folder: "invoices",
      mimeType: "application/pdf",
      size: 6 * 1024 * 1024,
      fileName: "invoice-001.pdf",
    });

    expect(result.ok).toBe(false);
  });

  it("allows attendance uploads to stay public when served from local storage", () => {
    expect(isPublicUploadPath("/uploads/employee/attendance/test.webp")).toBe(
      true,
    );
    expect(
      isPublicUploadPath("/uploads/employee/attendance/user-1/test.webp"),
    ).toBe(true);
    expect(isPublicUploadPath("/uploads/profiles/test.webp")).toBe(false);
  });

  it("allows branding logos to be served publicly from local storage", () => {
    expect(isPublicUploadPath("/uploads/logos/logo-aplikasi.webp")).toBe(true);
    expect(isPublicUploadPath("/uploads/logos/logo-invoice.webp")).toBe(true);
  });
});

describe("namespace tenant pada jalur upload", () => {
  it("mengenali tenant dari jalur ber-namespace", () => {
    expect(
      tenantJalurUpload("/uploads/tenants/tenant-a/marketing/x.webp"),
    ).toBe("tenant-a");
  });

  it("jalur lama tidak punya tenant", () => {
    expect(tenantJalurUpload("/uploads/marketing/x.webp")).toBeNull();
    expect(tenantJalurUpload("/uploads/tenants/")).toBeNull();
    expect(tenantJalurUpload(undefined)).toBeNull();
  });

  // Foto absensi sengaja dibiarkan publik. Setelah jalurnya ber-namespace,
  // aturan itu harus tetap berlaku — kalau tidak, layar yang menampilkannya
  // tanpa sesi akan mendadak kosong.
  it("prefix publik tetap berlaku setelah jalurnya ber-namespace", () => {
    expect(
      isPublicUploadPath(
        "/uploads/tenants/tenant-a/employee/attendance/a.webp",
      ),
    ).toBe(true);
    expect(isPublicUploadPath("/uploads/employee/attendance/a.webp")).toBe(
      true,
    );
  });

  it("jalur privat tidak ikut menjadi publik karena segmen tenant", () => {
    expect(
      isPublicUploadPath(
        "/uploads/tenants/tenant-a/marketing/canvasing/ktp.webp",
      ),
    ).toBe(false);
  });

  it("tenant dibaca dari direktori lokal untuk menyusun kunci R2", () => {
    expect(
      tenantDariDirektoriUpload("public/uploads/tenants/tenant-a/marketing"),
    ).toBe("tenant-a");
    expect(tenantDariDirektoriUpload("public/uploads/marketing")).toBeNull();
  });
});

describe("kanonik jalur upload", () => {
  it("jalur biasa dikembalikan apa adanya", () => {
    expect(kanonikJalurUpload("/uploads/tenants/a/x.webp")).toBe(
      "/uploads/tenants/a/x.webp",
    );
  });

  // Jalur yang sudah lolos pemeriksaan tenant pernah berakhir menunjuk berkas
  // tenant lain karena handler statis Next men-decode `%2f` sesudahnya.
  it("separator ter-encode ikut dinormalkan sebelum keputusan izin", () => {
    expect(kanonikJalurUpload("/uploads/tenants/a/..%2fb/x.webp")).toBe(
      "/uploads/tenants/b/x.webp",
    );
    expect(kanonikJalurUpload("/uploads/tenants/a/%2e%2e%2fb/x.webp")).toBe(
      "/uploads/tenants/b/x.webp",
    );
  });

  it("traversal biasa dinormalkan", () => {
    expect(kanonikJalurUpload("/uploads/tenants/a/../b/x.webp")).toBe(
      "/uploads/tenants/b/x.webp",
    );
  });

  it("tenant dibaca dari bentuk kanonik, bukan dari jalur mentah", () => {
    const kanonik = kanonikJalurUpload("/uploads/tenants/a/..%2fb/x.webp");
    expect(tenantJalurUpload(kanonik)).toBe("b");
  });

  it("menolak jalur yang keluar dari direktori uploads", () => {
    expect(kanonikJalurUpload("/uploads/../etc/passwd")).toBeNull();
    expect(kanonikJalurUpload("/uploads/..%2f..%2fetc/passwd")).toBeNull();
  });

  it("menolak backslash dan NUL", () => {
    expect(kanonikJalurUpload("/uploads/tenants/a%5c..%5cb/x.webp")).toBeNull();
    expect(kanonikJalurUpload("/uploads/tenants/a/x.webp%00.txt")).toBeNull();
  });

  it("menolak encoding yang rusak dan jalur di luar uploads", () => {
    expect(kanonikJalurUpload("/uploads/%E0%A4%A")).toBeNull();
    expect(kanonikJalurUpload("/api/mobile/upload")).toBeNull();
    expect(kanonikJalurUpload(undefined)).toBeNull();
  });

  // Nama berkas berspasi dulu bergantung pada handler statis Next untuk
  // men-decode-nya; sekarang blok upload sendiri yang harus menanganinya.
  it("men-decode nama berkas yang ter-encode", () => {
    expect(kanonikJalurUpload("/uploads/tenants/a/spasi%20file.webp")).toBe(
      "/uploads/tenants/a/spasi file.webp",
    );
  });
});
