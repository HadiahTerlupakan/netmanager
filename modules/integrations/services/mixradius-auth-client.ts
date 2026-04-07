import type { AxiosInstance } from "axios";

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

export async function loadMixRadiusCredentials(): Promise<MixRadiusCredentials> {
  try {
    const activeConfig = await mixRadiusConfigRepo.getActiveConfig();
    if (activeConfig) {
      return {
        username: activeConfig.username,
        password: activeConfig.password,
        baseUrl: activeConfig.apiUrl.replace(/\/$/, ""),
      };
    }
  } catch {
    // silent fallback to env
  }

  return {
    username: process.env.MIXRADIUS_USERNAME || "",
    password: process.env.MIXRADIUS_PASSWORD || "",
    baseUrl: (process.env.MIXRADIUS_URL || "").replace(/\/$/, ""),
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

  if (!credentials.baseUrl || !credentials.baseUrl.startsWith("http")) {
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
    await client.get(`${credentials.baseUrl}/rad-admin`);
    await randomDelay(800, 2000);

    const formData = new URLSearchParams({
      username: credentials.username,
      password: credentials.password,
    });

    const loginResponse = await client.post(
      `${credentials.baseUrl}/rad-admin/post`,
      formData.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: `${credentials.baseUrl}/rad-admin`,
          Origin: credentials.baseUrl,
        },
        maxRedirects: 5,
      },
    );

    const responseUrl = loginResponse.request?.res?.responseUrl || "";
    if (responseUrl.includes("dashboard") || loginResponse.status === 200) {
      return {
        isLoggedIn: true,
        loginExpiresAt: Date.now() + 50 * 60 * 1000,
        loggedInCredentials: {
          username: credentials.username,
          baseUrl: credentials.baseUrl,
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
