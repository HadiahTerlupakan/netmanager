import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetActiveConfig } = vi.hoisted(() => ({
  mockGetActiveConfig: vi.fn(),
}));

vi.mock(
  "@/modules/integrations/repositories/MixRadiusConfigRepository",
  () => ({
    mixRadiusConfigRepo: {
      getActiveConfig: mockGetActiveConfig,
    },
  }),
);

import {
  loadMixRadiusCredentials,
  loginMixRadius,
} from "@/modules/integrations/services/mixradius-auth-client";

const originalEnv = {
  MIXRADIUS_USERNAME: process.env.MIXRADIUS_USERNAME,
  MIXRADIUS_PASSWORD: process.env.MIXRADIUS_PASSWORD,
  MIXRADIUS_URL: process.env.MIXRADIUS_URL,
};

describe("mixradius-auth-client credential loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MIXRADIUS_USERNAME = originalEnv.MIXRADIUS_USERNAME;
    process.env.MIXRADIUS_PASSWORD = originalEnv.MIXRADIUS_PASSWORD;
    process.env.MIXRADIUS_URL = originalEnv.MIXRADIUS_URL;
  });

  it("uses the active DB config and trims trailing slash from the URL", async () => {
    mockGetActiveConfig.mockResolvedValue({
      username: "db-user",
      password: "db-pass",
      apiUrl: "https://mixradius.example.com/",
    });

    await expect(loadMixRadiusCredentials()).resolves.toEqual({
      username: "db-user",
      password: "db-pass",
      baseUrl: "https://mixradius.example.com",
    });
  });

  it("falls back to environment credentials when no active config exists", async () => {
    process.env.MIXRADIUS_USERNAME = "env-user";
    process.env.MIXRADIUS_PASSWORD = "env-pass";
    process.env.MIXRADIUS_URL = "https://env.example.com/";
    mockGetActiveConfig.mockResolvedValue(null);

    await expect(loadMixRadiusCredentials()).resolves.toEqual({
      username: "env-user",
      password: "env-pass",
      baseUrl: "https://env.example.com",
    });
  });

  it("throws a config error when the active config has an invalid URL", async () => {
    mockGetActiveConfig.mockResolvedValue({
      username: "db-user",
      password: "db-pass",
      apiUrl: "",
    });

    await expect(loadMixRadiusCredentials()).rejects.toMatchObject({
      name: "MixRadiusConfigError",
      message:
        "URL MixRadius tidak valid atau belum dikonfigurasi. Silakan periksa pengaturan integrasi.",
    });
  });

  it("throws a config error when env fallback URL is invalid", async () => {
    mockGetActiveConfig.mockResolvedValue(null);
    process.env.MIXRADIUS_USERNAME = "env-user";
    process.env.MIXRADIUS_PASSWORD = "env-pass";
    process.env.MIXRADIUS_URL = "://invalid";

    await expect(loadMixRadiusCredentials()).rejects.toMatchObject({
      name: "MixRadiusConfigError",
      message:
        "URL MixRadius tidak valid atau belum dikonfigurasi. Silakan periksa pengaturan integrasi.",
    });
  });
});

describe("loginMixRadius config validation", () => {
  it("rejects invalid credentials before attempting login", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
    };

    await expect(
      loginMixRadius({
        client: client as never,
        credentials: {
          username: "env-user",
          password: "env-pass",
          baseUrl: "",
        },
        session: {
          isLoggedIn: false,
          loginExpiresAt: 0,
          loggedInCredentials: null,
        },
        randomDelay: vi.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toMatchObject({
      name: "MixRadiusConfigError",
    });

    expect(client.get).not.toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalled();
  });

  it("rejects login when HTTP 200 returns a non-dashboard page", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ status: 200 }),
      post: vi.fn().mockResolvedValue({
        status: 200,
        data: "<html><title>LOGIN</title><body>Try again</body></html>",
        request: {
          res: {
            responseUrl: "https://mixradius.example.com/rad-admin/post",
          },
        },
      }),
    };

    await expect(
      loginMixRadius({
        client: client as never,
        credentials: {
          username: "env-user",
          password: "env-pass",
          baseUrl: "https://mixradius.example.com",
        },
        session: {
          isLoggedIn: false,
          loginExpiresAt: 0,
          loggedInCredentials: null,
        },
        randomDelay: vi.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toThrow("MixRadius login failed");
  });
});
