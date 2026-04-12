import { describe, expect, it } from "vitest";

import { IntegrationFactory } from "@/modules/integrations/factories/IntegrationFactory";

describe("IntegrationFactory MixRadius helpers", () => {
  it("normalizes bare MixRadius base URLs with https and removes trailing slash", () => {
    const config = IntegrationFactory.createMixRadiusConfig({
      name: "Server Jakarta",
      baseUrl: "mixradius.example.com/",
      username: "admin",
      password: "secret",
    });

    expect(config.baseUrl).toBe("https://mixradius.example.com");
  });

  it("accepts normalized MixRadius URLs and rejects unsupported protocols", () => {
    expect(
      IntegrationFactory.validateUrl("https://mixradius.example.com"),
    ).toEqual({
      isValid: true,
    });
    expect(
      IntegrationFactory.validateUrl("ftp://mixradius.example.com"),
    ).toEqual({
      isValid: false,
      error: "Protocol tidak didukung",
    });
  });
});
