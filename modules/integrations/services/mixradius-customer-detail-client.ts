import { logger } from "@/lib/logger";
import { parseMixRadiusInvoicesFromHtml } from "./mixradius-invoice-utils";
import { parseCustomerDetailHtml } from "./mixradius-customer-helpers";
import {
  MixRadiusConfigError,
  type FetchCustomersParams,
  type MixRadiusCustomerDetail,
  type MixRadiusCustomerResponse,
} from "./mixradius-types";
import type { MixRadiusCustomerClientParams } from "./mixradius-customer-client.types";
import {
  getCustomerConfigError,
  isMixRadiusConfigError,
} from "./mixradius-customer-errors";

const CUSTOMER_DETAIL_DELAY_MIN_IN_MS = 200;
const CUSTOMER_DETAIL_DELAY_MAX_IN_MS = 600;
const CUSTOMER_DETAIL_NOT_FOUND_MARKERS = [
  "404 - Data Not Found",
  "Data tidak ditemukan",
] as const;

export async function fetchMixRadiusCustomerDetail(
  params: MixRadiusCustomerClientParams & {
    customerId: string;
    fetchCustomersPPP: (
      params: FetchCustomersParams,
    ) => Promise<MixRadiusCustomerResponse>;
  },
): Promise<MixRadiusCustomerDetail> {
  const { client, baseUrl, login, onSessionExpired, randomDelay, customerId } =
    params;

  try {
    await login();
    await randomDelay(
      CUSTOMER_DETAIL_DELAY_MIN_IN_MS,
      CUSTOMER_DETAIL_DELAY_MAX_IN_MS,
    );
    const response = await client.get(
      `${baseUrl}/rad-customers/edit/${customerId}`,
      {
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: `${baseUrl}/rad-customers/ppp`,
        },
      },
    );

    const html = response.data as string;
    assertCustomerSessionIsValid(html, onSessionExpired);
    const resolvedCustomerId = await resolveAlternateCustomerIdIfNeeded(
      html,
      customerId,
      params.fetchCustomersPPP,
    );
    if (resolvedCustomerId) {
      return fetchMixRadiusCustomerDetail({
        ...params,
        customerId: resolvedCustomerId,
      });
    }

    warnIfUnexpectedCustomerStructure(html, customerId);
    const customerDetail = {
      ...parseCustomerDetailHtml(html, customerId),
      invoices: parseMixRadiusInvoicesFromHtml(html),
    };
    assertCustomerDetailLooksValid(customerDetail, html, customerId);
    return customerDetail;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    if (
      error instanceof MixRadiusConfigError ||
      isMixRadiusConfigError(message)
    ) {
      throw error instanceof MixRadiusConfigError
        ? error
        : getCustomerConfigError(message, "fetchCustomerDetail");
    }

    logger.error("[MixRadius] Fetch customer detail error:", message);
    throw new Error(`Failed to fetch customer detail: ${message}`);
  }
}

function assertCustomerSessionIsValid(
  html: string,
  onSessionExpired: () => void,
) {
  if (html.includes("LOGIN</title>") || html.includes("rad-admin/post")) {
    onSessionExpired();
    throw new Error("Session expired, please refresh");
  }
}

async function resolveAlternateCustomerIdIfNeeded(
  html: string,
  customerId: string,
  fetchCustomersPPP: (
    params: FetchCustomersParams,
  ) => Promise<MixRadiusCustomerResponse>,
) {
  if (
    !CUSTOMER_DETAIL_NOT_FOUND_MARKERS.some((marker) => html.includes(marker))
  ) {
    return null;
  }

  logger.error(
    `[MixRadius] 404 Not Found for ID ${customerId}. URL: unresolved/rad-customers/edit/${customerId}`,
  );
  if (customerId.length <= 6 || !/^\d+$/.test(customerId)) {
    throw new Error(
      "Data pelanggan tidak ditemukan (404). ID mungkin salah atau data telah dihapus.",
    );
  }

  const resolvedCustomerId = await resolveCustomerId(
    customerId,
    fetchCustomersPPP,
  );
  if (!resolvedCustomerId || resolvedCustomerId === customerId) {
    throw new Error(
      "Data pelanggan tidak ditemukan (404). ID mungkin salah atau data telah dihapus.",
    );
  }

  return resolvedCustomerId;
}

async function resolveCustomerId(
  customerId: string,
  fetchCustomersPPP: (
    params: FetchCustomersParams,
  ) => Promise<MixRadiusCustomerResponse>,
) {
  try {
    const searchResult = await fetchCustomersPPP({
      start: 0,
      length: 1,
      search: customerId,
      searchType: "username",
    });
    return searchResult.data[0]?.id;
  } catch (resolveError) {
    logger.error("[MixRadius] ID resolution failed:", resolveError);
    return undefined;
  }
}

function warnIfUnexpectedCustomerStructure(html: string, customerId: string) {
  const hasCorrectHeader =
    /<h4>\s*<i[^>]*class="[^"]*fa-edit[^"]*"[^>]*><\/i>[\s\S]*?(Edit|Detail)[\s\S]*?<\/h4>/i.test(
      html,
    ) ||
    (html.includes("id_plan") && html.includes("username"));

  if (!hasCorrectHeader) {
    logger.warn(
      `[MixRadius] Page structure check failed for customer ${customerId}. Marker elements not found.`,
    );
  }
}

function assertCustomerDetailLooksValid(
  customerDetail: MixRadiusCustomerDetail,
  html: string,
  customerId: string,
) {
  if (customerDetail.username || customerDetail.member_id) {
    return;
  }

  logger.error(
    `[MixRadius] Scraping Validation Failed for ID ${customerId}. HTML snippet: ${html.substring(0, 500)}...`,
  );
  throw new Error(
    "Integration Error: MixRadius Admin Panel layout may have changed. Failed to extract core customer data.",
  );
}
