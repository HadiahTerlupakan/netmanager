import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsRepository } from "@/modules/settings/repositories/SettingsRepository";
import { getPublicCaptchaSettings } from "@/modules/settings/services/publicCaptchaSettings";

vi.mock("@/modules/settings/repositories/SettingsRepository", () => ({
  SettingsRepository: {
    findManyByKeys: vi.fn(),
  },
}));

describe("getPublicCaptchaSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns site key only when captcha is enabled", async () => {
    vi.mocked(SettingsRepository.findManyByKeys).mockResolvedValue([
      { key: "captcha_enabled", value: "true", encrypted: false },
      { key: "captcha_site_key", value: "site-key", encrypted: false },
    ]);

    await expect(getPublicCaptchaSettings()).resolves.toEqual({
      enabled: true,
      siteKey: "site-key",
    });
  });

  it("hides site key when captcha is disabled", async () => {
    vi.mocked(SettingsRepository.findManyByKeys).mockResolvedValue([
      { key: "captcha_enabled", value: "false", encrypted: false },
      { key: "captcha_site_key", value: "site-key", encrypted: false },
    ]);

    await expect(getPublicCaptchaSettings()).resolves.toEqual({
      enabled: false,
      siteKey: "",
    });
  });
});
