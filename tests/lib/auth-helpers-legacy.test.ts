import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readAuthHelpersSource = () =>
  readFileSync(resolve(process.cwd(), "lib/auth-helpers.ts"), "utf8");

describe("auth-helpers legacy file", () => {
  it("keeps deprecation marker while avoiding hardcoded admin assumptions", () => {
    const source = readAuthHelpersSource();

    expect(source).toContain("@deprecated");
    expect(source).not.toContain('session.user.role = "ADMIN"');
    expect(source).not.toContain('return session?.user?.role === "ADMIN"');
  });
});
