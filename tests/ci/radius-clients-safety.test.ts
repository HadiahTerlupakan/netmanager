import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readRadiusClientsConfig(): string {
  return readFileSync(
    resolve(process.cwd(), "config", "radius", "clients.conf"),
    "utf8",
  );
}

function getClientBlock(config: string, clientName: string): string {
  const blockPattern = new RegExp(
    `client\\s+${clientName}\\s*\\{[\\s\\S]*?\\n\\}`,
    "m",
  );
  const match = config.match(blockPattern);

  return match?.[0] ?? "";
}

describe("FreeRADIUS clients safety", () => {
  it("does not define a wildcard fallback NAS client", () => {
    const config = readRadiusClientsConfig();
    const clientBlock = getClientBlock(config, "all_routers");

    expect(clientBlock).toBe("");
    expect(config).not.toContain("0.0.0.0/0");
  });
});
