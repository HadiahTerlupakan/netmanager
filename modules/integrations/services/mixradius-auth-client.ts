import type { AxiosInstance } from "axios";

import { logger } from "@/lib/logger";
import { getTenantIdFromContext } from "@/lib/tenant-context";

import type { IMixRadiusConfigRepository } from "../domain/ports/IMixRadiusConfigRepository";
import { IntegrationFactory } from "../factories/IntegrationFactory";
import { mixRadiusConfigRepo } from "../repositories/MixRadiusConfigRepository";
import {
  MixRadiusConfigError,
  type MixRadiusCredentials,
} from "./mixradius-types";

const LOGIN_DELAY_MIN_IN_MS = 800;
const LOGIN_DELAY_MAX_IN_MS = 2000;
const SESSION_TTL_IN_MS = 50 * 60 * 1000;

type MixRadiusLoginResponse = Awaited<ReturnType<typeof submitLoginRequest>>;

export type MixRadiusSessionState = {
  isLoggedIn: boolean;
  loginExpiresAt: number;
  loggedInCredentials: { username: string; baseUrl: string } | null;
};

/** Load MixRadius credentials from active tenant config or environment fallback. */
export async function loadMixRadiusCredentials(
  configRepository: IMixRadiusConfigRepository = mixRadiusConfigRepo,
): Promise<MixRadiusCredentials> {
  const tenantContext = await getTenantIdFromContext();

  if (!tenantContext.tenantId && !tenantContext.isSuperAdmin) {
    throw new MixRadiusConfigError(
      "Tenant MixRadius tidak ditemukan untuk request ini.",
    );
  }

  let activeConfig = null;
  if (tenantContext.tenantId) {
    activeConfig = await configRepository.getActiveConfigByTenant(
      tenantContext.tenantId,
    );
  } else {
    activeConfig = await configRepository.getActiveConfig();
  }

  if (activeConfig) {
    return buildValidatedCredentials(activeConfig.apiUrl, {
      username: activeConfig.username,
      password: activeConfig.password,
    });
  }

  if (tenantContext.tenantId && !tenantContext.isSuperAdmin) {
    throw new MixRadiusConfigError(
      "Akun MixRadius tenant ini belum dikonfigurasi.",
    );
  }

  return buildValidatedCredentials(process.env.MIXRADIUS_URL || "", {
    username: process.env.MIXRADIUS_USERNAME || "",
    password: process.env.MIXRADIUS_PASSWORD || "",
  });
}

/** Login to MixRadius and return refreshed session state. */
export async function loginMixRadius(params: {
  client: AxiosInstance;
  credentials: MixRadiusCredentials;
  session: MixRadiusSessionState;
  randomDelay: (min?: number, max?: number) => Promise<void>;
}): Promise<MixRadiusSessionState> {
  const { client, credentials, session, randomDelay } = params;
  if (canReuseSession(session, credentials)) {
    return session;
  }

  const normalizedBaseUrl = validateBaseUrl(credentials.baseUrl);
  ensureCredentialsExist(credentials);

  return await performLogin({
    client,
    normalizedBaseUrl,
    credentials,
    randomDelay,
  });
}

/** Perform the login request to MixRadius. */
async function performLogin(params: {
  client: AxiosInstance;
  normalizedBaseUrl: string;
  credentials: MixRadiusCredentials;
  randomDelay: (min?: number, max?: number) => Promise<void>;
}) {
  try {
    await params.client.get(`${params.normalizedBaseUrl}/rad-admin`);
    await params.randomDelay(LOGIN_DELAY_MIN_IN_MS, LOGIN_DELAY_MAX_IN_MS);
    const loginResponse = await submitLoginRequest({
      client: params.client,
      normalizedBaseUrl: params.normalizedBaseUrl,
      credentials: params.credentials,
    });

    validateLoginResponse(loginResponse, params.credentials.username);

    return buildLoggedInSession(
      params.credentials.username,
      params.normalizedBaseUrl,
    );
  } catch (error: unknown) {
    throw handleLoginError(error);
  }
}

function validateLoginResponse(
  responseData: MixRadiusLoginResponse,
  username: string,
) {
  if (!isSuccessfulLogin(responseData, username)) {
    throw new Error("Login may have failed - unexpected response");
  }
}

function handleLoginError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "Terjadi kesalahan";
  logger.error("[MixRadius] Login error:", { message });
  return new Error(`MixRadius login failed: ${message}`);
}

function buildValidatedCredentials(
  apiUrl: string,
  credentials: Pick<MixRadiusCredentials, "username" | "password">,
): MixRadiusCredentials {
  const baseUrl = validateBaseUrl(apiUrl);
  return {
    username: credentials.username,
    password: credentials.password,
    baseUrl,
  };
}

function canReuseSession(
  session: MixRadiusSessionState,
  credentials: MixRadiusCredentials,
) {
  return (
    session.isLoggedIn &&
    session.loginExpiresAt > Date.now() &&
    session.loggedInCredentials?.username === credentials.username &&
    session.loggedInCredentials?.baseUrl === credentials.baseUrl
  );
}

function validateBaseUrl(baseUrl: string) {
  const normalizedBaseUrl =
    IntegrationFactory.normalizeMixRadiusBaseUrl(baseUrl);
  const validation = IntegrationFactory.validateUrl(normalizedBaseUrl);

  if (!validation.isValid) {
    logger.warn("[MixRadius] Invalid or missing Base URL");
    throw new MixRadiusConfigError(
      "URL MixRadius tidak valid atau belum dikonfigurasi. Silakan periksa pengaturan integrasi.",
    );
  }

  return normalizedBaseUrl;
}

function ensureCredentialsExist(credentials: MixRadiusCredentials) {
  if (!credentials.username || !credentials.password) {
    logger.warn("[MixRadius] Missing credentials");
    throw new MixRadiusConfigError(
      "Username atau Password MixRadius belum dikonfigurasi.",
    );
  }
}

async function submitLoginRequest(params: {
  client: AxiosInstance;
  normalizedBaseUrl: string;
  credentials: MixRadiusCredentials;
}) {
  const { client, normalizedBaseUrl, credentials } = params;
  const formData = new URLSearchParams({
    username: credentials.username,
    password: credentials.password,
  });

  return client.post(
    `${normalizedBaseUrl}/rad-admin/post`,
    formData.toString(),
    buildLoginRequestConfig(normalizedBaseUrl),
  );
}

function buildLoginRequestConfig(normalizedBaseUrl: string) {
  return {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${normalizedBaseUrl}/rad-admin`,
      Origin: normalizedBaseUrl,
    },
    maxRedirects: 5,
  };
}

function isSuccessfulLogin(
  loginResponse: MixRadiusLoginResponse,
  username: string,
) {
  const responseUrl = loginResponse.request?.res?.responseUrl || "";
  const responseHtml =
    typeof loginResponse.data === "string" ? loginResponse.data : "";
  const reachedDashboard = responseUrl.includes("dashboard");
  const looksLikeLoginPage =
    responseHtml.includes("<title>LOGIN</title>") ||
    responseUrl.includes("/rad-admin/post");

  if (!reachedDashboard || looksLikeLoginPage) {
    logger.warn("[MixRadius] Login response did not reach dashboard", {
      username,
      responseUrl,
    });
    return false;
  }

  return true;
}

function buildLoggedInSession(
  username: string,
  baseUrl: string,
): MixRadiusSessionState {
  return {
    isLoggedIn: true,
    loginExpiresAt: Date.now() + SESSION_TTL_IN_MS,
    loggedInCredentials: {
      username,
      baseUrl,
    },
  };
}
