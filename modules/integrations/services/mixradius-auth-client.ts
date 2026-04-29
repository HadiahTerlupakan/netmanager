import type { AxiosInstance } from "axios";

import { getTenantIdFromContext } from "@/lib/tenant-context";
import type { IMixRadiusConfigRepository } from "@/modules/integrations/domain/ports/IMixRadiusConfigRepository";
import { IntegrationFactory } from "@/modules/integrations/factories/IntegrationFactory";
import { mixRadiusConfigRepo } from "@/modules/integrations/repositories/MixRadiusConfigRepository";

import {
  MixRadiusConfigError,
  type MixRadiusCredentials,
} from "./MixRadiusService";

export type MixRadiusSessionState = {
  isLoggedIn: boolean;
  loginExpiresAt: number;
  loggedInCredentials: { username: string; baseUrl: string } | null;
};

export async function loadMixRadiusCredentials(
  configRepository: IMixRadiusConfigRepository = mixRadiusConfigRepo,
): Promise<MixRadiusCredentials> {
  const tenantContext = await getTenantIdFromContext();
  const activeConfig = tenantContext.tenantId
    ? await configRepository.getActiveConfigByTenant(tenantContext.tenantId)
    : await configRepository.getActiveConfig();

  if (activeConfig) {
    const baseUrl = IntegrationFactory.normalizeMixRadiusBaseUrl(
      activeConfig.apiUrl,
    );
    const validation = IntegrationFactory.validateUrl(baseUrl);

    if (!validation.isValid) {
      throw new MixRadiusConfigError(
        "URL MixRadius tidak valid atau belum dikonfigurasi. Silakan periksa pengaturan integrasi.",
      );
    }

    return {
      username: activeConfig.username,
      password: activeConfig.password,
      baseUrl,
    };
  }

  if (tenantContext.tenantId && !tenantContext.isSuperAdmin) {
    throw new MixRadiusConfigError(
      "Akun MixRadius tenant ini belum dikonfigurasi.",
    );
  }

  const baseUrl = IntegrationFactory.normalizeMixRadiusBaseUrl(
    process.env.MIXRADIUS_URL || "",
  );
  const validation = IntegrationFactory.validateUrl(baseUrl);

  if (!validation.isValid) {
    throw new MixRadiusConfigError(
      "URL MixRadius tidak valid atau belum dikonfigurasi. Silakan periksa pengaturan integrasi.",
    );
  }

  return {
    username: process.env.MIXRADIUS_USERNAME || "",
    password: process.env.MIXRADIUS_PASSWORD || "",
    baseUrl,
  };
}

export async function loginMixRadius(params: {
  client: AxiosInstance;
  credentials: MixRadiusCredentials;
  session: MixRadiusSessionState;
  randomDelay: (min?: number, max?: number) => Promise<void>;
}): Promise<MixRadiusSessionState> {
  const { client, credentials, session, randomDelay } = params;

  if (session.isLoggedIn && session.loginExpiresAt > Date.now()) {
    if (
      session.loggedInCredentials &&
      session.loggedInCredentials.username === credentials.username &&
      session.loggedInCredentials.baseUrl === credentials.baseUrl
    ) {
      return session;
    }
  }

  const normalizedBaseUrl = IntegrationFactory.normalizeMixRadiusBaseUrl(
    credentials.baseUrl,
  );
  const validation = IntegrationFactory.validateUrl(normalizedBaseUrl);

  if (!validation.isValid) {
    console.warn("[MixRadius] Invalid or missing Base URL");
    throw new MixRadiusConfigError(
      "URL MixRadius tidak valid atau belum dikonfigurasi. Silakan periksa pengaturan integrasi.",
    );
  }

  if (!credentials.username || !credentials.password) {
    console.warn("[MixRadius] Missing credentials");
    throw new MixRadiusConfigError(
      "Username atau Password MixRadius belum dikonfigurasi.",
    );
  }

  try {
    await client.get(`${normalizedBaseUrl}/rad-admin`);
    await randomDelay(800, 2000);

    const formData = new URLSearchParams({
      username: credentials.username,
      password: credentials.password,
    });

    const loginResponse = await client.post(
      `${normalizedBaseUrl}/rad-admin/post`,
      formData.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: `${normalizedBaseUrl}/rad-admin`,
          Origin: normalizedBaseUrl,
        },
        maxRedirects: 5,
      },
    );

    const responseUrl = loginResponse.request?.res?.responseUrl || "";
    const responseHtml =
      typeof loginResponse.data === "string" ? loginResponse.data : "";
    const reachedDashboard = responseUrl.includes("dashboard");
    const looksLikeLoginPage =
      responseHtml.includes("<title>LOGIN</title>") ||
      responseUrl.includes("/rad-admin/post");

    if (reachedDashboard && !looksLikeLoginPage) {
      return {
        isLoggedIn: true,
        loginExpiresAt: Date.now() + 50 * 60 * 1000,
        loggedInCredentials: {
          username: credentials.username,
          baseUrl: normalizedBaseUrl,
        },
      };
    }

    throw new Error("Login may have failed - unexpected response");
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    console.error("[MixRadius] Login error:", message);
    throw new Error(`MixRadius login failed: ${message}`);
  }
}
