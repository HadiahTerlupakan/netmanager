import type { AxiosInstance } from "axios";
import { CookieJar } from "tough-cookie";

import {
  createMixRadiusHttpClient,
  createMixRadiusResetClient,
} from "./mixradius-service.config";
import type { MixRadiusSessionState } from "./mixradius-auth-client";

export type MixRadiusSessionSnapshot = {
  jar: CookieJar;
  client: AxiosInstance;
  isLoggedIn: boolean;
  loginExpiresAt: number;
  loggedInCredentials: { username: string; baseUrl: string } | null;
};

export function createMixRadiusSessionSnapshot(): MixRadiusSessionSnapshot {
  const jar = new CookieJar();
  return {
    jar,
    client: createMixRadiusHttpClient(jar),
    isLoggedIn: false,
    loginExpiresAt: 0,
    loggedInCredentials: null,
  };
}

export function buildSessionState(
  snapshot: MixRadiusSessionSnapshot,
): MixRadiusSessionState {
  return {
    isLoggedIn: snapshot.isLoggedIn,
    loginExpiresAt: snapshot.loginExpiresAt,
    loggedInCredentials: snapshot.loggedInCredentials,
  };
}

export function applySessionState(
  snapshot: MixRadiusSessionSnapshot,
  session: MixRadiusSessionState,
): MixRadiusSessionSnapshot {
  return {
    ...snapshot,
    isLoggedIn: session.isLoggedIn,
    loginExpiresAt: session.loginExpiresAt,
    loggedInCredentials: session.loggedInCredentials,
  };
}

export function expireSession(
  snapshot: MixRadiusSessionSnapshot,
): MixRadiusSessionSnapshot {
  return {
    ...snapshot,
    isLoggedIn: false,
    loginExpiresAt: 0,
    loggedInCredentials: null,
  };
}

export function resetCookieSession(
  snapshot: MixRadiusSessionSnapshot,
): MixRadiusSessionSnapshot {
  const jar = new CookieJar();
  return {
    ...snapshot,
    jar,
    client: createMixRadiusHttpClient(jar),
  };
}

export function resetHttpSession(
  snapshot: MixRadiusSessionSnapshot,
): MixRadiusSessionSnapshot {
  const jar = new CookieJar();
  return {
    ...snapshot,
    jar,
    client: createMixRadiusResetClient(jar),
  };
}
