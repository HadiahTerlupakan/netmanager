import { describe, expect, it } from "vitest";

import { MixRadiusConfigService } from "@/modules/integrations/services/MixRadiusConfigService";

describe("MixRadiusConfigService dependencies", () => {
  it("requires a config repository port", () => {
    expect(() => new MixRadiusConfigService()).toThrow(
      "MixRadius config repository wajib disediakan",
    );
  });
});
