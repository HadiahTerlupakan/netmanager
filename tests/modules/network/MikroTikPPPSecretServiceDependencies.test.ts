import { describe, expect, it } from "vitest";

import { MikroTikPPPSecretService } from "@/modules/network/services/MikroTikPPPSecretService";

describe("MikroTikPPPSecretService dependencies", () => {
  it("requires repository ports", () => {
    expect(() => new MikroTikPPPSecretService()).toThrow(
      "MikroTik PPP Secret dependencies wajib disediakan",
    );
  });
});
