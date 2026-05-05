import type { AxiosInstance } from "axios";

import {
  calculateEstimatedSummary,
  calculateInlineSummary,
  isMixRadiusConfigErrorMessage,
} from "./mixradius-income-helpers";
import {
  applyIncomeFilters,
  paginateIncomeRecords,
} from "./mixradius-income-filters";
import { fetchAllIncomePeriodData } from "./mixradius-income-fetcher";
import {
  parseOwnerOptions,
  parseProfitReport,
  type MixRadiusProfitReport,
} from "./mixradius-income-client.parsers";
import {
  MixRadiusConfigError,
  type FetchCustomersParams,
  type MixRadiusIncomePeriodResponse,
  type MixRadiusIncomeSummary,
  type MixRadiusOwner,
} from "./mixradius-types";

type MixRadiusIncomeClientParams = {
  client: AxiosInstance;
  baseUrl: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  randomDelay: (min?: number, max?: number) => Promise<void>;
};

const INCOME_REQUEST_DELAY_MIN_IN_MS = 300;
const INCOME_REQUEST_DELAY_MAX_IN_MS = 800;
const SUMMARY_FETCH_LIMIT = 10000;

/** Fetch income rows by period from MixRadius. */
export async function fetchMixRadiusIncomeByPeriod(
  params: MixRadiusIncomeClientParams & { filters?: FetchCustomersParams },
): Promise<MixRadiusIncomePeriodResponse> {
  const {
    client,
    baseUrl,
    login,
    onSessionExpired,
    randomDelay,
    filters = {},
  } = params;
  const { start = 0, length = 10 } = filters;

  try {
    await login();
    await randomDelay(
      INCOME_REQUEST_DELAY_MIN_IN_MS,
      INCOME_REQUEST_DELAY_MAX_IN_MS,
    );
    const upstreamData = await fetchAllIncomePeriodData({
      client,
      baseUrl,
      filters,
      onSessionExpired,
    });
    const filteredRecords = await applyIncomeFilters(
      upstreamData.records,
      filters,
    );
    return {
      draw: 1,
      recordsTotal: upstreamData.recordsTotal,
      recordsFiltered: filteredRecords.length,
      data: paginateIncomeRecords(filteredRecords, start, length),
      summary: calculateInlineSummary(filteredRecords),
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    if (
      error instanceof MixRadiusConfigError ||
      isMixRadiusConfigErrorMessage(message)
    ) {
      console.warn(
        `[MixRadius] Integration not available (fetchIncomeByPeriod): ${message}`,
      );
      throw error instanceof MixRadiusConfigError
        ? error
        : new MixRadiusConfigError(message);
    }

    console.error("[MixRadius] Fetch income period error:", message);
    if (
      message.includes("session") ||
      (error as { response?: { status: number } }).response?.status === 401
    ) {
      onSessionExpired();
      throw new Error("Session expired, please refresh");
    }

    throw new Error(`Failed to fetch Income Period data: ${message}`);
  }
}

/** Fetch income summary from MixRadius. */
export async function fetchMixRadiusIncomeSummary(
  params: MixRadiusIncomeClientParams & { filters?: FetchCustomersParams },
): Promise<MixRadiusIncomeSummary> {
  try {
    const result = await fetchMixRadiusIncomeByPeriod({
      ...params,
      filters: {
        ...params.filters,
        start: 0,
        length: SUMMARY_FETCH_LIMIT,
        search: "",
      },
    });

    return (
      result.summary ||
      calculateEstimatedSummary(result.data, result.recordsFiltered)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      error instanceof MixRadiusConfigError ||
      isMixRadiusConfigErrorMessage(message)
    ) {
      console.warn(
        `[MixRadius] Integration not available (fetchIncomeSummary): ${message}`,
      );
      throw error instanceof MixRadiusConfigError
        ? error
        : new MixRadiusConfigError(message);
    }

    console.error("[MixRadius] Failed to fetch income summary:", error);
    throw error;
  }
}

/** Fetch MixRadius owners with numeric identifiers. */
export async function fetchMixRadiusOwnersWithIds(
  params: MixRadiusIncomeClientParams,
): Promise<MixRadiusOwner[]> {
  const { client, baseUrl, login } = params;

  try {
    await login();
    const response = await client.get(
      `${baseUrl}/rad-reports/income-by-period`,
      {
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      },
    );

    return parseOwnerOptions(response.data as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      error instanceof MixRadiusConfigError ||
      isMixRadiusConfigErrorMessage(message)
    ) {
      console.warn(
        `[MixRadius] Integration not available (getOwnersWithIds): ${message}`,
      );
      throw error instanceof MixRadiusConfigError
        ? error
        : new MixRadiusConfigError(message);
    }

    console.error("[MixRadius] Failed to fetch owners from HTML:", error);
    return [];
  }
}

export { fetchMixRadiusUniqueOwners } from "./mixradius-income-client.unique-owners";

/** Delete an income record in MixRadius. */
export async function deleteMixRadiusIncomeRecord(
  params: MixRadiusIncomeClientParams & { id: string },
): Promise<boolean> {
  const { client, baseUrl, login, id } = params;

  try {
    await login();
    const formData = new URLSearchParams();
    formData.append("save", "Delete");
    const response = await client.post(
      `${baseUrl}/rad-reports/delete/${id}`,
      formData.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: `${baseUrl}/rad-reports/income-by-period`,
        },
      },
    );
    return response.status === 200;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    if (
      error instanceof MixRadiusConfigError ||
      isMixRadiusConfigErrorMessage(message)
    ) {
      console.warn(
        `[MixRadius] Integration not available (deleteIncomeRecord): ${message}`,
      );
      throw error instanceof MixRadiusConfigError
        ? error
        : new MixRadiusConfigError(message);
    }
    console.error(`[MixRadius] Delete record ${id} error:`, message);
    throw new Error(`Failed to delete record: ${message}`);
  }
}

/** Get printable invoice HTML from MixRadius. */
export async function getMixRadiusPrintInvoiceHtml(
  params: MixRadiusIncomeClientParams & {
    id: string;
    type?: "standard" | "thermal";
  },
): Promise<string> {
  const { client, baseUrl, login, id, type = "standard" } = params;

  try {
    await login();
    const response = await client.get(
      `${baseUrl}/rad-reports/print-invoice/${id}/${type}`,
      {
        headers: {
          Referer: `${baseUrl}/rad-reports/income-by-period`,
        },
      },
    );
    return response.data as string;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    if (isMixRadiusConfigErrorMessage(message)) {
      console.warn(
        `[MixRadius] Integration not available (getPrintInvoiceHtml): ${message}`,
      );
      return '<div style="padding:20px;text-align:center;"><h3>MixRadius Integration Not Configured</h3><p>Please configure MixRadius credentials in Settings.</p></div>';
    }

    console.error("[MixRadius] Get print HTML error:", message);
    throw new Error(`Failed to get print view: ${message}`);
  }
}

/** Fetch yearly profit arrays from MixRadius. */
export async function fetchMixRadiusProfitReport(
  params: MixRadiusIncomeClientParams,
): Promise<MixRadiusProfitReport> {
  const { client, baseUrl, login } = params;

  try {
    await login();
    const response = await client.get(`${baseUrl}/rad-reports/profit-load`);
    return parseProfitReport(response.data as string);
  } catch (error) {
    if (error instanceof MixRadiusConfigError) {
      throw error;
    }

    console.error("[MixRadius] Error fetching profit report:", error);
    return {
      income: Array(12).fill(0),
      transactions: Array(12).fill(0),
      sellerFees: Array(12).fill(0),
      taxes: Array(12).fill(0),
    };
  }
}
