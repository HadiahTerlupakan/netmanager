import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  buildServiceAccountJwt,
  completedProductionReleases,
  fetchProductionReleases,
  readServiceAccount,
} from "@/lib/google-play/production-track";

describe("completedProductionReleases", () => {
  it("keeps only fully released builds with their version names", () => {
    expect(
      completedProductionReleases({
        releases: [
          { name: "1.0.9 (49)", versionCodes: ["49"], status: "completed" },
          { name: "50 (1.0.10)", versionCodes: ["50"], status: "inProgress" },
          { name: "48 (1.0.9)", versionCodes: ["48"], status: "halted" },
        ],
      }),
    ).toEqual([{ versionCode: 49, versionName: "1.0.9" }]);
  });

  it("reads the version from the default Play Console release name", () => {
    expect(
      completedProductionReleases({
        releases: [
          { name: "48 (1.0.9)", versionCodes: ["48"], status: "completed" },
        ],
      }),
    ).toEqual([{ versionCode: 48, versionName: "1.0.9" }]);
  });

  it("returns nothing for an empty track", () => {
    expect(completedProductionReleases({})).toEqual([]);
  });
});

describe("service account", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const account = {
    client_email: "sync@project.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    token_uri: "https://oauth2.googleapis.com/token",
  };

  it("accepts the JSON either raw or base64-encoded", () => {
    const raw = JSON.stringify(account);
    expect(readServiceAccount(raw)?.client_email).toBe(account.client_email);
    expect(
      readServiceAccount(Buffer.from(raw).toString("base64"))?.client_email,
    ).toBe(account.client_email);
    expect(readServiceAccount(undefined)).toBeNull();
  });

  it("signs an RS256 assertion scoped to the Play publisher API", () => {
    const jwt = buildServiceAccountJwt(account, 1_000);
    const [header, payload, signature] = jwt.split(".");

    expect(
      verify(
        "RSA-SHA256",
        Buffer.from(`${header}.${payload}`),
        publicKey,
        Buffer.from(signature!, "base64url"),
      ),
    ).toBe(true);
    expect(
      JSON.parse(Buffer.from(payload!, "base64url").toString()),
    ).toMatchObject({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: account.token_uri,
      iat: 1_000,
    });
  });

  it("reads the production track inside a throwaway edit", async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      const body = url.endsWith("/token")
        ? { access_token: "token" }
        : url.endsWith("/edits")
          ? { id: "edit-1" }
          : url.endsWith("/tracks/production")
            ? {
                releases: [
                  {
                    name: "1.0.9 (49)",
                    versionCodes: ["49"],
                    status: "completed",
                  },
                ],
              }
            : {};
      return new Response(JSON.stringify(body), { status: 200 });
    });

    const releases = await fetchProductionReleases(
      account,
      fetcher as typeof fetch,
    );

    expect(releases).toEqual([{ versionCode: 49, versionName: "1.0.9" }]);
    expect(calls.at(-1)).toMatch(/^DELETE .*\/edits\/edit-1$/);
  });
});
