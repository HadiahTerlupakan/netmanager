import { sign } from "node:crypto";

const PACKAGE_NAME = "com.netmanager.mobile";
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const JWT_LIFETIME_SECONDS = 3600;

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export interface PlayProductionRelease {
  versionCode: number;
  versionName: string | null;
}

interface TrackRelease {
  name?: string;
  versionCodes?: string[];
  status?: string;
}

/**
 * Isi `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: JSON akun layanan, mentah atau
 * base64 (lebih mudah ditaruh di secret YAML). Null bila belum diset.
 */
export function readServiceAccount(
  raw: string | undefined,
): ServiceAccount | null {
  if (!raw?.trim()) return null;
  const text = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw.trim(), "base64").toString("utf8");
  const parsed = JSON.parse(text) as ServiceAccount;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON tidak berisi client_email/private_key",
    );
  }
  return parsed;
}

/** JWT RS256 untuk ditukar dengan access token OAuth Google. */
export function buildServiceAccountJwt(
  account: ServiceAccount,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: account.client_email,
    scope: SCOPE,
    aud: account.token_uri ?? DEFAULT_TOKEN_URI,
    iat: nowSeconds,
    exp: nowSeconds + JWT_LIFETIME_SECONDS,
  })}`;
  const signature = sign(
    "RSA-SHA256",
    Buffer.from(unsigned),
    account.private_key,
  );
  return `${unsigned}.${signature.toString("base64url")}`;
}

/**
 * Build yang sudah dirilis penuh di jalur produksi. Rilis bertahap
 * (`inProgress`) dan yang dihentikan (`halted`) belum dibagikan ke semua
 * orang, jadi belum boleh dijadikan versi wajib. Nama rilis ditulis pipeline
 * sebagai "1.0.9 (49)" dan oleh Play Console sebagai "49 (1.0.9)".
 */
export function completedProductionReleases(track: {
  releases?: TrackRelease[];
}): PlayProductionRelease[] {
  return (track.releases ?? [])
    .filter((release) => release.status === "completed")
    .flatMap((release) => {
      const versionName =
        release.name?.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? null;
      return (release.versionCodes ?? []).map((code) => ({
        versionCode: Number(code),
        versionName,
      }));
    })
    .filter((release) => Number.isInteger(release.versionCode));
}

async function requestJson<T>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetcher(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Google Play ${response.status}: ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** Baca jalur produksi lewat edit sekali pakai yang langsung dibuang. */
export async function fetchProductionReleases(
  account: ServiceAccount,
  fetcher: typeof fetch = fetch,
): Promise<PlayProductionRelease[]> {
  const { access_token } = await requestJson<{ access_token: string }>(
    fetcher,
    account.token_uri ?? DEFAULT_TOKEN_URI,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: buildServiceAccountJwt(account),
      }),
    },
  );
  const headers = { authorization: `Bearer ${access_token}` };
  const edit = await requestJson<{ id: string }>(fetcher, `${API}/edits`, {
    method: "POST",
    headers,
  });
  try {
    const track = await requestJson<{ releases?: TrackRelease[] }>(
      fetcher,
      `${API}/edits/${edit.id}/tracks/production`,
      { headers },
    );
    return completedProductionReleases(track);
  } finally {
    await fetcher(`${API}/edits/${edit.id}`, {
      method: "DELETE",
      headers,
    }).catch((): undefined => undefined);
  }
}
