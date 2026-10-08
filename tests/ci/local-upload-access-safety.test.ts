import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readServerFile(): string {
  return readFileSync(resolve(process.cwd(), "server.ts"), "utf8");
}

describe("local upload access safety", () => {
  it("allows public attendance upload paths before the auth gate", () => {
    const serverFile = readServerFile();

    expect(serverFile).toContain(
      'import { isPublicUploadPath } from "./lib/upload/upload-policy";',
    );
    expect(serverFile).toContain("if (isPublicUploadPath(pathname)) {");
    expect(serverFile).toContain("if (!punyaSesi) {");

    const publicPathIndex = serverFile.indexOf(
      "if (isPublicUploadPath(pathname)) {",
    );
    const authGateIndex = serverFile.indexOf("if (!punyaSesi) {");

    expect(publicPathIndex).toBeGreaterThan(-1);
    expect(authGateIndex).toBeGreaterThan(publicPathIndex);
  });

  // Penjaga ini pernah hanya mengenal cookie NextAuth, sehingga aplikasi mobile
  // — yang memegang Bearer token, bukan cookie — tidak pernah bisa menampilkan
  // foto yang baru saja ia unggah sendiri.
  it("routes the auth gate through the shared upload access check", () => {
    const serverFile = readServerFile();

    expect(serverFile).toContain(
      'import { punyaSesiBacaUpload } from "./lib/upload/upload-access";',
    );
    expect(serverFile).toContain("await punyaSesiBacaUpload(req)");
    expect(serverFile).not.toContain('from "next-auth/jwt"');
  });
});
