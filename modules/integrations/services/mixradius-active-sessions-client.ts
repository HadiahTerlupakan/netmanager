import { logger } from "@/lib/logger";
import { MixRadiusConfigError } from "./mixradius-types";
import type { MixRadiusCustomerClientParams } from "./mixradius-customer-client.types";
import {
  getCustomerConfigError,
  isMixRadiusConfigError,
} from "./mixradius-customer-errors";

const ACTIVE_SESSION_PAGE_SIZE = "5000";
const ACTIVE_SESSION_DELAY_MIN_IN_MS = 200;
const ACTIVE_SESSION_DELAY_MAX_IN_MS = 500;

export async function fetchMixRadiusActiveSessionsPPP(
  params: MixRadiusCustomerClientParams & { search?: string },
): Promise<Map<string, { ip: string; uptime: string }>> {
  const { client, baseUrl, login, randomDelay, search = "" } = params;

  try {
    await login();
    await randomDelay(
      ACTIVE_SESSION_DELAY_MIN_IN_MS,
      ACTIVE_SESSION_DELAY_MAX_IN_MS,
    );
    const response = await client.post(
      `${baseUrl}/rad-get-data/active-ppp&sid=SSP-38`,
      buildActiveSessionFormData(search).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          Referer: `${baseUrl}/rad-users-session/active-ppp`,
        },
      },
    );

    return buildActiveSessionMap(response.data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    if (
      error instanceof MixRadiusConfigError ||
      isMixRadiusConfigError(message)
    ) {
      throw error instanceof MixRadiusConfigError
        ? error
        : getCustomerConfigError(message, "fetchActiveSessionsPPP");
    }

    logger.error("[MixRadius] Failed to fetch active sessions:", message);
    return new Map();
  }
}

function buildActiveSessionFormData(search: string) {
  const formData = new URLSearchParams();
  formData.append("draw", "1");
  formData.append("start", "0");
  formData.append("length", ACTIVE_SESSION_PAGE_SIZE);
  formData.append("search[value]", search);
  formData.append("search[regex]", "false");
  return formData;
}

function buildActiveSessionMap(responseData: unknown) {
  const activeMap = new Map<string, { ip: string; uptime: string }>();
  const sessions = extractSessionsFromResponse(responseData);

  sessions.forEach((session) => {
    const username = String(session.username || session.member_id || "");
    if (!username) return;

    activeMap.set(username, {
      ip: String(session.framedipaddress || ""),
      uptime: String(session.acctsessiontime || ""),
    });
  });

  return activeMap;
}

function extractSessionsFromResponse(responseData: unknown) {
  return responseData &&
    typeof responseData === "object" &&
    Array.isArray((responseData as { data?: unknown[] }).data)
    ? (responseData as { data: Record<string, unknown>[] }).data
    : [];
}
