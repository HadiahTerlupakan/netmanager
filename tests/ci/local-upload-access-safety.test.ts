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
    expect(serverFile).toContain("if (!token) {");

    const publicPathIndex = serverFile.indexOf(
      "if (isPublicUploadPath(pathname)) {",
    );
    const authGateIndex = serverFile.indexOf("if (!token) {");

    expect(publicPathIndex).toBeGreaterThan(-1);
    expect(authGateIndex).toBeGreaterThan(publicPathIndex);
  });
});
