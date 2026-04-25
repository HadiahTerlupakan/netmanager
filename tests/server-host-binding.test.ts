import { readFileSync } from "fs";
import { join } from "path";
import { expect, test } from "vitest";

const serverSource = readFileSync(join(process.cwd(), "server.ts"), "utf8");

test("custom server binds to configured hostname instead of all interfaces", () => {
  expect(serverSource).toContain('process.env.HOSTNAME || "127.0.0.1"');
  expect(serverSource).toContain("server.listen(port, hostname");
  expect(serverSource).not.toContain('server.listen(port, "0.0.0.0"');
});
