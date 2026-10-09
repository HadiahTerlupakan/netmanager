import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readServerFile(): string {
  return readFileSync(resolve(process.cwd(), "server.ts"), "utf8");
}

describe("local upload access safety", () => {
  it("allows public attendance upload paths before the auth gate", () => {
    const serverFile = readServerFile();

    expect(serverFile).toContain('from "./lib/upload/upload-policy"');
    expect(serverFile).toContain("if (isPublicUploadPath(jalurUpload)) {");
    expect(serverFile).toContain("if (!pembaca) {");

    const publicPathIndex = serverFile.indexOf(
      "if (isPublicUploadPath(jalurUpload)) {",
    );
    const authGateIndex = serverFile.indexOf("if (!pembaca) {");

    expect(publicPathIndex).toBeGreaterThan(-1);
    expect(authGateIndex).toBeGreaterThan(publicPathIndex);
  });

  // Penjaga ini pernah hanya mengenal cookie NextAuth, sehingga aplikasi mobile
  // — yang memegang Bearer token, bukan cookie — tidak pernah bisa menampilkan
  // foto yang baru saja ia unggah sendiri.
  it("routes the auth gate through the shared upload access check", () => {
    const serverFile = readServerFile();

    expect(serverFile).toContain('from "./lib/upload/upload-access"');
    expect(serverFile).toContain("await pembacaUploadDariSesi(req)");
    expect(serverFile).not.toContain('from "next-auth/jwt"');
  });

  // Sesi sah saja tidak cukup: tanpa pemeriksaan ini, pemegang sesi tenant mana
  // pun bisa membaca berkas tenant lain asal tahu URL-nya.
  it("enforces tenant ownership after the session check", () => {
    const serverFile = readServerFile();

    expect(serverFile).toContain("bolehBacaJalurUpload(pembaca, jalurUpload)");

    const sessionGateIndex = serverFile.indexOf("if (!pembaca) {");
    const tenantGateIndex = serverFile.indexOf(
      "if (!bolehBacaJalurUpload(pembaca, jalurUpload)) {",
    );

    expect(tenantGateIndex).toBeGreaterThan(-1);
    expect(tenantGateIndex).toBeGreaterThan(sessionGateIndex);
  });

  // Pemeriksaan izin dan pemilihan berkas wajib memakai bentuk jalur yang sama.
  // Saat keduanya berbeda, `/uploads/tenants/<sendiri>/..%2f<lain>/x.webp` lolos
  // sebagai milik sendiri lalu menyajikan berkas tenant lain secara utuh.
  it("decides and serves from the same canonical path", () => {
    const serverFile = readServerFile();

    expect(serverFile).toContain("kanonikJalurUpload(pathname)");
    expect(serverFile).toContain("isPublicUploadPath(jalurUpload)");
    expect(serverFile).toContain("bolehBacaJalurUpload(pembaca, jalurUpload)");
    expect(serverFile).toContain(
      'const relativePath = jalurUpload.replace(/^\\/uploads\\//, "");',
    );
  });

  // `public/` adalah direktori statis Next; meneruskan `/uploads/` ke sana
  // membuat handler lain menerapkan decoding-nya sendiri atas jalur yang sudah
  // lolos penjaga.
  it("never falls through to the Next.js handler for uploads", () => {
    const serverFile = readServerFile();

    expect(serverFile).not.toContain(
      "// File not found - fall through to Next.js handler",
    );
    expect(serverFile).toContain(
      'JSON.stringify({ error: "File tidak ditemukan" })',
    );
  });

  // Berkas pribadi di R2 kini dirujuk lewat jalur ini, bukan URL publik bucket.
  // Isinya hanya boleh dialirkan setelah penjaga sesi dan tenant terlewati.
  it("streams private R2 objects only after both guards", () => {
    const serverFile = readServerFile();

    expect(serverFile).toContain("downloadFromR2(kunciR2)");

    const tenantGateIndex = serverFile.indexOf(
      "if (!bolehBacaJalurUpload(pembaca, jalurUpload)) {",
    );
    const r2Index = serverFile.indexOf("downloadFromR2(kunciR2)");

    expect(r2Index).toBeGreaterThan(-1);
    expect(r2Index).toBeGreaterThan(tenantGateIndex);
  });
});
