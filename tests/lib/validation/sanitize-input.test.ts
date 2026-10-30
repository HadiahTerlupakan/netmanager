import { describe, expect, it } from "vitest";
import { sanitizeString } from "@/lib/validation/middleware";
import { sanitizeBarangInput } from "@/modules/inventory/validators/barangValidator";

// A single pass of a removal regex can rebuild what it removes from the
// pieces around it, so each sanitizer must reach a fixed point.
describe("sanitizeString", () => {
  it.each([
    ["javajavascript:script:alert(1)", /javascript:/i],
    ["jajavascript:vascrjavascript:ipt:alert(1)", /javascript:/i],
    ['x" oonclick=nclick=alert(1)', /on\w+=/i],
  ])("leaves no %s behind", (input, banned) => {
    expect(sanitizeString(input)).not.toMatch(banned);
  });

  it("keeps ordinary text", () => {
    expect(sanitizeString("  Paket 20 Mbps (promo)  ")).toBe(
      "Paket 20 Mbps (promo)",
    );
  });
});

describe("sanitizeBarangInput", () => {
  it.each([
    "<img src=x onerror=alert(1)",
    "<<b>script>alert(1)</script>",
    "kabel <scr<script>ipt>",
  ])("leaves no angle bracket in %j", (input) => {
    expect(sanitizeBarangInput(input)).not.toMatch(/[<>]/);
  });

  it("strips tags and keeps the text", () => {
    expect(sanitizeBarangInput("  <b>Kabel</b> drop  ")).toBe("Kabel drop");
  });
});
