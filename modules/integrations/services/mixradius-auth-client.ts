import type { AxiosInstance } from "axios";
import axios from "axios";

import { logger } from "@/lib/logger";
import { getTenantIdFromContext } from "@/lib/tenant-context";

import type { IMixRadiusConfigRepository } from "../domain/ports/IMixRadiusConfigRepository";
import { IntegrationFactory } from "../factories/IntegrationFactory";
import { mixRadiusConfigRepo } from "../repositories/MixRadiusConfigRepository";
import { MIXRADIUS_LOGIN_TIMEOUT_MS } from "./mixradius-service.config";
import {
  MixRadiusConfigError,
  type MixRadiusCredentials,
} from "./mixradius-types";

const LOGIN_DELAY_MIN_IN_MS = 800;
const LOGIN_DELAY_MAX_IN_MS = 2000;
const SESSION_TTL_IN_MS = 50 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 2;
const LOGIN_RETRY_BACKOFF_MS = 1_000;
const LOGIN_FAIL_CIRCUIT_MS = 2 * 60 * 1000;

const loginCircuitOpenUntil = new Map<string, number>();

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

async function performLogin(params: {
  client: AxiosInstance;
  normalizedBaseUrl: string;
  credentials: MixRadiusCredentials;
  randomDelay: (min?: number, max?: number) => Promise<void>;
}) {
  const circuitKey = `${params.normalizedBaseUrl}|${params.credentials.username}`;
  const circuitUntil = loginCircuitOpenUntil.get(circuitKey) ?? 0;
  if (circuitUntil > Date.now()) {
    const waitSec = Math.ceil((circuitUntil - Date.now()) / 1000);
    throw new Error(
      `MixRadius login circuit open — retry in ${waitSec}s (recent timeout/failure)`,
    );
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= LOGIN_MAX_ATTEMPTS; attempt++) {
    try {
      await params.client.get(`${params.normalizedBaseUrl}/rad-admin`, {
        timeout: MIXRADIUS_LOGIN_TIMEOUT_MS,
      });
      await params.randomDelay(LOGIN_DELAY_MIN_IN_MS, LOGIN_DELAY_MAX_IN_MS);
      const loginResponse = await submitLoginRequest({
        client: params.client,
        normalizedBaseUrl: params.normalizedBaseUrl,
        credentials: params.credentials,
      });

      validateLoginResponse(loginResponse, params.credentials.username);
      loginCircuitOpenUntil.delete(circuitKey);

      return buildLoggedInSession(
        params.credentials.username,
        params.normalizedBaseUrl,
      );
    } catch (error: unknown) {
      lastError = error;
      if (error instanceof MixRadiusConfigError) {
        throw error;
      }
      if (!isRetriableLoginError(error) || attempt >= LOGIN_MAX_ATTEMPTS) {
        break;
      }
      logger.warn(
        `[MixRadius] Login attempt ${attempt} failed, retrying…`,
        error instanceof Error ? error.message : error,
      );
      await new Promise((r) => setTimeout(r, LOGIN_RETRY_BACKOFF_MS * attempt));
    }
  }

  if (isTimeoutError(lastError)) {
    loginCircuitOpenUntil.set(circuitKey, Date.now() + LOGIN_FAIL_CIRCUIT_MS);
  }
  throw handleLoginError(lastError);
}

function isTimeoutError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error && /timeout/i.test(error.message);
  }
  return (
    error.code === "ECONNABORTED" ||
    error.code === "ETIMEDOUT" ||
    /timeout/i.test(error.message)
  );
}

function isRetriableLoginError(error: unknown): boolean {
  if (error instanceof MixRadiusConfigError) return false;
  if (isTimeoutError(error)) return true;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return (
      status === undefined ||
      status >= 500 ||
      error.code === "ERR_NETWORK" ||
      error.code === "ECONNRESET"
    );
  }
  return false;
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
  if (error instanceof MixRadiusConfigError) {
    return error;
  }
  const message = error instanceof Error ? error.message : "Terjadi kesalahan";
  const kind = isTimeoutError(error) ? "timeout" : "error";
  logger.error("[MixRadius] Login error:", { message, kind });
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
    timeout: MIXRADIUS_LOGIN_TIMEOUT_MS,
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
