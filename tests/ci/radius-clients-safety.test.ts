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
  it("hardens the all_routers client block with message authenticator and proxy state checks", () => {
    const config = readRadiusClientsConfig();
    const clientBlock = getClientBlock(config, "all_routers");

    expect(clientBlock).toContain("require_message_authenticator = yes");
    expect(clientBlock).toContain("limit_proxy_state = yes");
  });
});
