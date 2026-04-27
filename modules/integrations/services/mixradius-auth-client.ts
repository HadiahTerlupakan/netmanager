import type { AxiosInstance } from "axios";

import { getTenantIdFromContext } from "@/lib/tenant-context";

import type { IMixRadiusConfigRepository } from "../domain/ports/IMixRadiusConfigRepository";
import { MixRadiusConfigRepository } from "../repositories/MixRadiusConfigRepository";
import { validateMixRadiusBaseUrl } from "../validators/MixRadiusConfigValidator";
import {
  MixRadiusConfigError,
  type MixRadiusCredentials,
} from "./MixRadiusService";

const DEFAULT_LOGIN_TTL_MS = 50 * 60 * 1000;
const DEFAULT_LOGIN_DELAY_MAX = 2000;
const DEFAULT_LOGIN_DELAY_MIN = 800;

export type MixRadiusSessionState = {
  isLoggedIn: boolean;
  loginExpiresAt: number;
  loggedInCredentials: { username: string; baseUrl: string } | null;
};

/** Load MixRadius credentials from tenant config or environment. */
export async function loadMixRadiusCredentials(
  configRepository: IMixRadiusConfigRepository = new MixRadiusConfigRepository(),
): Promise<MixRadiusCredentials> {
  const tenantContext = await getTenantIdFromContext();
  const activeConfig = await getActiveConfig(configRepository, tenantContext);

  if (activeConfig) {
    return mapStoredCredentials(
      activeConfig.apiUrl,
      activeConfig.username,
      activeConfig.password,
    );
  }

  if (tenantContext.tenantId && !tenantContext.isSuperAdmin) {
    throw new MixRadiusConfigError(
      "Akun MixRadius tenant ini belum dikonfigurasi.",
    );
  }

  return mapStoredCredentials(
    process.env.MIXRADIUS_URL || "",
    process.env.MIXRADIUS_USERNAME || "",
    process.env.MIXRADIUS_PASSWORD || "",
  );
}

/** Login to MixRadius and return the next session state. */
export async function loginMixRadius(params: {
  client: AxiosInstance;
  credentials: MixRadiusCredentials;
  session: MixRadiusSessionState;
  randomDelay: (min?: number, max?: number) => Promise<void>;
}): Promise<MixRadiusSessionState> {
  const { client, credentials, session, randomDelay } = params;

  if (isReusableSession(session, credentials)) {
    return session;
  }

  const validatedCredentials = validateCredentials(credentials);

  try {
    await client.get(`${validatedCredentials.baseUrl}/rad-admin`);
    await randomDelay(DEFAULT_LOGIN_DELAY_MIN, DEFAULT_LOGIN_DELAY_MAX);
    const loginResponse = await submitLogin(client, validatedCredentials);

    if (isDashboardResponse(loginResponse)) {
      return buildLoggedInSession(validatedCredentials);
    }

    throw new Error("Login may have failed - unexpected response");
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    console.error("[MixRadius] Login error:", message);
    throw new Error(`MixRadius login failed: ${message}`);
  }
}

async function getActiveConfig(
  configRepository: IMixRadiusConfigRepository,
  tenantContext: { tenantId: string | null; isSuperAdmin: boolean },
) {
  if (tenantContext.tenantId) {
    return configRepository.getActiveConfigByTenant(tenantContext.tenantId);
  }

  return configRepository.getActiveConfig();
}

function mapStoredCredentials(
  rawBaseUrl: string,
  username: string,
  password: string,
): MixRadiusCredentials {
  const { normalizedBaseUrl, validation } =
    validateMixRadiusBaseUrl(rawBaseUrl);

  const baseUrl = normalizedBaseUrl;

  if (!validation.isValid) {
    throw new MixRadiusConfigError(
      "URL MixRadius tidak valid atau belum dikonfigurasi. Silakan periksa pengaturan integrasi.",
    );
  }

  return { username, password, baseUrl };
}

function isReusableSession(
  session: MixRadiusSessionState,
  credentials: MixRadiusCredentials,
) {
  if (!session.isLoggedIn || session.loginExpiresAt <= Date.now()) {
    return false;
  }

  return (
    session.loggedInCredentials?.username === credentials.username &&
    session.loggedInCredentials?.baseUrl === credentials.baseUrl
  );
}

function validateCredentials(credentials: MixRadiusCredentials) {
  const { normalizedBaseUrl, validation } = validateMixRadiusBaseUrl(
    credentials.baseUrl,
  );

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

  return { ...credentials, baseUrl: normalizedBaseUrl };
}

async function submitLogin(
  client: AxiosInstance,
  credentials: MixRadiusCredentials,
) {
  const formData = new URLSearchParams({
    username: credentials.username,
    password: credentials.password,
  });

  return client.post(
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
}

function isDashboardResponse(loginResponse: {
  request?: { res?: { responseUrl?: string } };
  data?: unknown;
}) {
  const responseUrl = loginResponse.request?.res?.responseUrl || "";
  const responseHtml =
    typeof loginResponse.data === "string" ? loginResponse.data : "";
  const reachedDashboard = responseUrl.includes("dashboard");
  const looksLikeLoginPage =
    responseHtml.includes("<title>LOGIN</title>") ||
    responseUrl.includes("/rad-admin/post");

  return reachedDashboard && !looksLikeLoginPage;
}

function buildLoggedInSession(
  credentials: MixRadiusCredentials,
): MixRadiusSessionState {
  return {
    isLoggedIn: true,
    loginExpiresAt: Date.now() + DEFAULT_LOGIN_TTL_MS,
    loggedInCredentials: {
      username: credentials.username,
      baseUrl: credentials.baseUrl,
    },
  };
}
