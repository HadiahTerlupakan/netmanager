import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetTenantIdFromContext, mockConfigRepository } = vi.hoisted(() => ({
  mockGetTenantIdFromContext: vi.fn(),
  mockConfigRepository: {
    getActiveConfig: vi.fn(),
    getActiveConfigByTenant: vi.fn(),
  },
}));

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: mockGetTenantIdFromContext,
}));

import {
  isMixRadiusRemoteEnabled,
  loadMixRadiusCredentials,
  loginMixRadius,
  type MixRadiusSessionState,
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
    mockGetTenantIdFromContext.mockResolvedValue({
      tenantId: null,
      isSuperAdmin: true,
    });
  });

  it("uses the tenant-scoped active DB config and trims trailing slash from the URL", async () => {
    mockGetTenantIdFromContext.mockResolvedValue({
      tenantId: "tenant-1",
      isSuperAdmin: false,
    });
    mockConfigRepository.getActiveConfigByTenant.mockResolvedValue({
      username: "db-user",
      password: "db-pass",
      apiUrl: "https://mixradius.example.com/",
    });

    await expect(
      loadMixRadiusCredentials(mockConfigRepository as never),
    ).resolves.toEqual({
      username: "db-user",
      password: "db-pass",
      baseUrl: "https://mixradius.example.com",
    });

    expect(mockConfigRepository.getActiveConfigByTenant).toHaveBeenCalledWith(
      "tenant-1",
    );
    expect(mockConfigRepository.getActiveConfig).not.toHaveBeenCalled();
  });

  it("falls back to environment credentials when superadmin has no active config", async () => {
    process.env.MIXRADIUS_USERNAME = "env-user";
    process.env.MIXRADIUS_PASSWORD = "env-pass";
    process.env.MIXRADIUS_URL = "https://env.example.com/";
    mockGetTenantIdFromContext.mockResolvedValue({
      tenantId: null,
      isSuperAdmin: true,
    });
    mockConfigRepository.getActiveConfig.mockResolvedValue(null);

    await expect(
      loadMixRadiusCredentials(mockConfigRepository as never),
    ).resolves.toEqual({
      username: "env-user",
      password: "env-pass",
      baseUrl: "https://env.example.com",
    });
  });

  it("throws a config error when the tenant-scoped active config has an invalid URL", async () => {
    mockGetTenantIdFromContext.mockResolvedValue({
      tenantId: "tenant-1",
      isSuperAdmin: false,
    });
    mockConfigRepository.getActiveConfigByTenant.mockResolvedValue({
      username: "db-user",
      password: "db-pass",
      apiUrl: "",
    });

    await expect(
      loadMixRadiusCredentials(mockConfigRepository as never),
    ).rejects.toMatchObject({
      name: "MixRadiusConfigError",
      message:
        "URL MixRadius tidak valid atau belum dikonfigurasi. Silakan periksa pengaturan integrasi.",
    });
  });

  it("throws a config error when tenant config is missing for non-superadmin", async () => {
    mockGetTenantIdFromContext.mockResolvedValue({
      tenantId: "tenant-1",
      isSuperAdmin: false,
    });
    mockConfigRepository.getActiveConfigByTenant.mockResolvedValue(null);

    await expect(
      loadMixRadiusCredentials(mockConfigRepository as never),
    ).rejects.toMatchObject({
      name: "MixRadiusConfigError",
      message: "Akun MixRadius tenant ini belum dikonfigurasi.",
    });
  });

  it("rejects global fallback when non-superadmin request has no tenant context", async () => {
    mockGetTenantIdFromContext.mockResolvedValue({
      tenantId: null,
      isSuperAdmin: false,
    });
    mockConfigRepository.getActiveConfig.mockResolvedValue({
      username: "global-user",
      password: "global-pass",
      apiUrl: "https://global.example.com/",
    });

    await expect(
      loadMixRadiusCredentials(mockConfigRepository as never),
    ).rejects.toMatchObject({
      name: "MixRadiusConfigError",
      message: "Tenant MixRadius tidak ditemukan untuk request ini.",
    });

    expect(mockConfigRepository.getActiveConfig).not.toHaveBeenCalled();
  });

  it("throws a config error when env fallback URL is invalid", async () => {
    mockGetTenantIdFromContext.mockResolvedValue({
      tenantId: null,
      isSuperAdmin: true,
    });
    mockConfigRepository.getActiveConfig.mockResolvedValue(null);
    process.env.MIXRADIUS_USERNAME = "env-user";
    process.env.MIXRADIUS_PASSWORD = "env-pass";
    process.env.MIXRADIUS_URL = "://invalid";

    await expect(
      loadMixRadiusCredentials(mockConfigRepository as never),
    ).rejects.toMatchObject({
      name: "MixRadiusConfigError",
      message:
        "URL MixRadius tidak valid atau belum dikonfigurasi. Silakan periksa pengaturan integrasi.",
    });
  });
});

describe("loginMixRadius config validation", () => {
  // Blok ini menguji mekanika login, bukan saklar penonaktifannya. Integrasi
  // remote dimatikan secara bawaan, jadi tanpa ini setiap tes di sini berhenti
  // di gerbang CAPTCHA dan tidak pernah menyentuh yang seharusnya diuji.
  beforeEach(() => {
    vi.stubEnv("MIXRADIUS_REMOTE_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

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
      // Pesannya ikut diperiksa: tanpa ini, tes lolos begitu saja ketika
      // gerbang penonaktifan melempar MixRadiusConfigError lebih dulu, dan
      // validasi URL yang jadi maksud tes ini tidak pernah teruji.
      message: expect.stringContaining("URL MixRadius tidak valid"),
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

/**
 * Panel MixRadius memakai CAPTCHA, sehingga login otomatis tidak akan pernah
 * berhasil. Blok ini mengunci perilaku penonaktifannya: mati secara bawaan,
 * berhenti sebelum menyentuh jaringan, dan tetap bisa dihidupkan lewat env.
 */
describe("penonaktifan integrasi remote MixRadius", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const sesiKosong: MixRadiusSessionState = {
    isLoggedIn: false,
    loginExpiresAt: 0,
    loggedInCredentials: null,
  };

  const kredensialSah = {
    username: "env-user",
    password: "env-pass",
    baseUrl: "https://mixradius.example.com",
  };

  it("mati secara bawaan tanpa env apa pun", () => {
    vi.stubEnv("MIXRADIUS_REMOTE_ENABLED", "");

    expect(isMixRadiusRemoteEnabled()).toBe(false);
  });

  it('hanya menyala pada nilai persis "true"', () => {
    vi.stubEnv("MIXRADIUS_REMOTE_ENABLED", "1");
    expect(isMixRadiusRemoteEnabled()).toBe(false);

    vi.stubEnv("MIXRADIUS_REMOTE_ENABLED", "TRUE");
    expect(isMixRadiusRemoteEnabled()).toBe(false);

    vi.stubEnv("MIXRADIUS_REMOTE_ENABLED", "true");
    expect(isMixRadiusRemoteEnabled()).toBe(true);
  });

  it("menolak login tanpa menyentuh jaringan", async () => {
    vi.stubEnv("MIXRADIUS_REMOTE_ENABLED", "");
    const client = { get: vi.fn(), post: vi.fn() };

    await expect(
      loginMixRadius({
        client: client as never,
        credentials: kredensialSah,
        session: sesiKosong,
        randomDelay: vi.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toMatchObject({
      name: "MixRadiusConfigError",
      message: expect.stringContaining("CAPTCHA"),
    });

    expect(client.get).not.toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalled();
  });

  it("menolak juga ketika sesi lama masih bisa dipakai ulang", async () => {
    // Gerbangnya sengaja di depan pemeriksaan sesi: kalau ditaruh sesudahnya,
    // proses yang sempat login sebelum penonaktifan tetap bisa menarik data.
    vi.stubEnv("MIXRADIUS_REMOTE_ENABLED", "");

    await expect(
      loginMixRadius({
        client: { get: vi.fn(), post: vi.fn() } as never,
        credentials: kredensialSah,
        session: {
          isLoggedIn: true,
          loginExpiresAt: Date.now() + 60 * 60 * 1000,
          loggedInCredentials: {
            username: kredensialSah.username,
            baseUrl: kredensialSah.baseUrl,
          },
        },
        randomDelay: vi.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toMatchObject({ name: "MixRadiusConfigError" });
  });

  it("meneruskan ke alur login ketika dinyalakan lagi", async () => {
    vi.stubEnv("MIXRADIUS_REMOTE_ENABLED", "true");
    const client = { get: vi.fn(), post: vi.fn() };

    // Gagal karena URL kosong, bukan karena gerbang — bukti gerbangnya lewat.
    await expect(
      loginMixRadius({
        client: client as never,
        credentials: { ...kredensialSah, baseUrl: "" },
        session: sesiKosong,
        randomDelay: vi.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("URL MixRadius tidak valid"),
    });
  });
});
