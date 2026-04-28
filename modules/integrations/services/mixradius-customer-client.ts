import { logger } from "@/lib/logger";
import { prismaBilling } from "@/lib/prisma-billing";
import { LRUCache } from "@/lib/utils/lru-cache";
import type { AxiosInstance } from "axios";

import {
  buildInvoiceCountCacheKey,
  parseMixRadiusInvoicesFromHtml,
} from "./mixradius-invoice-utils";
import {
  buildMixRadiusAllowedOwners,
  normalizeMixRadiusOwnerName,
} from "../utils/mixradius-owner-matching";
import {
  MixRadiusConfigError,
  type FetchCustomersParams,
  type MixRadiusCustomer,
  type MixRadiusCustomerDetail,
  type MixRadiusCustomerResponse,
} from "./MixRadiusService";

export type MixRadiusCustomerCacheState = {
  data: MixRadiusCustomer[];
  expiresAt: number;
};

type MixRadiusCustomerClientParams = {
  client: AxiosInstance;
  baseUrl: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  randomDelay: (min?: number, max?: number) => Promise<void>;
};

const MAX_SESSION_RETRY = 1;

function isMixRadiusConfigError(message: string) {
  return (
    message.includes("konfigurasi") ||
    message.includes("valid") ||
    message.includes("Missing credentials")
  );
}

function getCustomerConfigError(message: string, context: string) {
  logger.warn(`[MixRadius] Integration not available (${context}): ${message}`);
  return new MixRadiusConfigError(message);
}

export async function fetchMixRadiusActiveSessionsPPP(
  params: MixRadiusCustomerClientParams & {
    search?: string;
  },
): Promise<Map<string, { ip: string; uptime: string }>> {
  const { client, baseUrl, login, randomDelay, search = "" } = params;

  try {
    await login();
    await randomDelay(200, 500);

    const formData = new URLSearchParams();
    formData.append("draw", "1");
    formData.append("start", "0");
    formData.append("length", "5000");
    formData.append("search[value]", search);
    formData.append("search[regex]", "false");

    const response = await client.post(
      `${baseUrl}/rad-get-data/active-ppp&sid=SSP-38`,
      formData.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          Referer: `${baseUrl}/rad-users-session/active-ppp`,
        },
      },
    );

    const activeMap = new Map<string, { ip: string; uptime: string }>();

    if (response.data && Array.isArray(response.data.data)) {
      const sessions = response.data.data;
      sessions.forEach((session: Record<string, unknown>) => {
        const username = String(session.username || session.member_id || "");
        const ip = String(session.framedipaddress || "");
        const uptime = String(session.acctsessiontime || "");

        if (username) {
          activeMap.set(username, { ip, uptime });
        }
      });
    }

    return activeMap;
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

export async function fetchMixRadiusCustomersPPP(
  params: MixRadiusCustomerClientParams & {
    filters?: FetchCustomersParams;
    cache: MixRadiusCustomerCacheState;
    customersCacheTtl: number;
    onResetClient: () => void;
    retryCount?: number;
  },
): Promise<{
  result: MixRadiusCustomerResponse;
  cache: MixRadiusCustomerCacheState;
}> {
  const {
    client,
    baseUrl,
    login,
    onSessionExpired,
    randomDelay,
    cache,
    customersCacheTtl,
    onResetClient,
    filters = {},
    retryCount = 0,
  } = params;
  const {
    start = 0,
    length = 10,
    search = "",
    searchType = "all",
    sortBy = "expired_on",
    sortDir = "asc",
    forceRefresh = false,
  } = filters;

  try {
    try {
      await login();
    } catch (loginError) {
      const errorMsg =
        loginError instanceof Error ? loginError.message : String(loginError);
      if (
        loginError instanceof MixRadiusConfigError ||
        errorMsg.includes("konfigurasi") ||
        errorMsg.includes("valid")
      ) {
        throw loginError instanceof MixRadiusConfigError
          ? loginError
          : new MixRadiusConfigError(errorMsg);
      }
      throw loginError;
    }

    let allData: MixRadiusCustomer[] = [];
    let nextCache = cache;

    if (
      !forceRefresh &&
      cache.data.length > 0 &&
      cache.expiresAt > Date.now()
    ) {
      allData = [...cache.data];
    } else {
      await randomDelay(500, 1500);

      const formData = new URLSearchParams();
      formData.append("draw", "1");
      formData.append("start", "0");
      formData.append("length", "10000");

      const columns = [
        { data: "id", searchable: false },
        { data: "member_id", searchable: true },
        { data: "username", searchable: true },
        { data: "fullname", searchable: true },
        { data: "address", searchable: true },
        { data: "nasporttype", searchable: false },
        { data: "plan_name", searchable: true },
        { data: "remote_address", searchable: false },
        { data: "renewed_on", searchable: true },
        { data: "expired_on", searchable: true },
        { data: "owner_name", searchable: true },
        { data: "auth_status", searchable: true },
        { data: "note", searchable: true },
        { data: "phonenumber", searchable: true },
      ];

      columns.forEach((col, idx) => {
        formData.append(`columns[${idx}][data]`, col.data);
        formData.append(`columns[${idx}][name]`, "");
        formData.append(
          `columns[${idx}][searchable]`,
          col.searchable ? "true" : "false",
        );
        formData.append(`columns[${idx}][orderable]`, "true");
        formData.append(`columns[${idx}][search][value]`, "");
        formData.append(`columns[${idx}][search][regex]`, "false");
      });

      formData.append("search[value]", "");
      formData.append("search[regex]", "false");
      formData.append("order[0][column]", "8");
      formData.append("order[0][dir]", "desc");

      const response = await client.post(
        `${baseUrl}/rad-get-data/customers-ppp`,
        formData.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            Accept: "application/json, text/javascript, */*; q=0.01",
            Origin: baseUrl,
            Referer: `${baseUrl}/rad-customers/ppp`,
          },
        },
      );

      if (
        typeof response.data === "string" &&
        response.data.includes("<!DOCTYPE")
      ) {
        if (retryCount >= MAX_SESSION_RETRY) {
          throw new Error(
            "MixRadius session expired repeatedly while fetching customers.",
          );
        }

        onSessionExpired();
        onResetClient();
        return fetchMixRadiusCustomersPPP({
          ...params,
          retryCount: retryCount + 1,
        });
      }

      const responseData = response.data as MixRadiusCustomerResponse;
      const rawData = responseData.data || [];
      const uniqueMap = new Map<string, MixRadiusCustomer>();

      rawData.forEach((item) => {
        if (item.username && !uniqueMap.has(item.username)) {
          const anyItem = item as MixRadiusCustomer & { DT_RowId?: string };
          if (anyItem.id && anyItem.id.length > 8 && anyItem.DT_RowId) {
            item.id = String(anyItem.DT_RowId).replace("row_", "");
          }
          uniqueMap.set(item.username, item);
        }
      });

      allData = Array.from(uniqueMap.values());
      nextCache = {
        data: allData,
        expiresAt: Date.now() + customersCacheTtl,
      };
    }

    const totalRecordsFromUpstream = allData.length;

    if (filters.siteId) {
      const groups = await prismaBilling.mixRadiusOwnerGroup.findMany({
        where: { siteId: filters.siteId },
        select: { owners: true },
      });

      const allowedOwners = buildMixRadiusAllowedOwners(
        groups.flatMap((group) => group.owners),
      );

      allData = allData.filter((item) => {
        if (!item.owner_name) return false;
        const normalizedOwner = normalizeMixRadiusOwnerName(item.owner_name);
        return (
          allowedOwners.has(normalizedOwner.full) ||
          allowedOwners.has(normalizedOwner.prefix)
        );
      });
    }

    if (filters.authStatus === "Isolir") {
      const now = new Date();
      allData = allData.filter((item) => {
        if (!item.expired_on) return false;
        const expDate = new Date(item.expired_on);
        if (Number.isNaN(expDate.getTime())) return false;
        return expDate < now;
      });
    } else if (filters.authStatus === "Disabled-Users") {
      const now = new Date();
      allData = allData.filter((item) => {
        if (
          item.auth_status === "Disabled-Users" ||
          item.auth_status === "disabled"
        )
          return true;
        if (item.expired_on) {
          const expDate = new Date(item.expired_on);
          if (!Number.isNaN(expDate.getTime()) && expDate < now) return true;
        }
        return false;
      });
    } else if (filters.authStatus) {
      allData = allData.filter(
        (item) => item.auth_status === filters.authStatus,
      );
    }

    if (search) {
      const lowerSearch = search.toLowerCase();
      if (searchType === "all") {
        allData = allData.filter(
          (item) =>
            (item.fullname &&
              item.fullname.toLowerCase().includes(lowerSearch)) ||
            (item.username &&
              item.username.toLowerCase().includes(lowerSearch)) ||
            (item.member_id &&
              item.member_id.toLowerCase().includes(lowerSearch)) ||
            (item.address &&
              item.address.toLowerCase().includes(lowerSearch)) ||
            (item.phonenumber &&
              item.phonenumber.toLowerCase().includes(lowerSearch)) ||
            (item.owner_name &&
              item.owner_name.toLowerCase().includes(lowerSearch)),
        );
      } else {
        allData = allData.filter((item) => {
          const fieldVal = (item as unknown as Record<string, unknown>)[
            searchType
          ];
          return (
            fieldVal && String(fieldVal).toLowerCase().includes(lowerSearch)
          );
        });
      }
    }

    if (filters.groupId) {
      const group = await prismaBilling.mixRadiusOwnerGroup.findUnique({
        where: { id: filters.groupId },
        select: { owners: true },
      });

      if (group && group.owners && group.owners.length > 0) {
        const allowedOwners = new Set<string>();
        group.owners.forEach((owner) => {
          const normalizedOwner = normalizeMixRadiusOwnerName(owner);
          allowedOwners.add(normalizedOwner.full);
          allowedOwners.add(normalizedOwner.prefix);
        });

        allData = allData.filter((item) => {
          if (!item.owner_name) return false;
          const normalizedOwner = normalizeMixRadiusOwnerName(item.owner_name);
          return (
            allowedOwners.has(normalizedOwner.full) ||
            allowedOwners.has(normalizedOwner.prefix)
          );
        });
      } else if (group) {
        allData = [];
      }
    }

    if (filters.ownerName) {
      const normalizedName = normalizeMixRadiusOwnerName(filters.ownerName);
      allData = allData.filter((item) => {
        if (!item.owner_name) return false;
        const normalizedOwner = normalizeMixRadiusOwnerName(item.owner_name);
        return (
          normalizedOwner.full === normalizedName.full ||
          normalizedOwner.prefix === normalizedName.prefix
        );
      });
    }

    let activeSessions = new Map<string, { ip: string; uptime: string }>();
    try {
      await randomDelay(100, 300);
      activeSessions = await fetchMixRadiusActiveSessionsPPP({
        client,
        baseUrl,
        login,
        onSessionExpired,
        randomDelay,
        search,
      });
    } catch {
      activeSessions = new Map();
    }

    allData = allData.map((customer) => {
      const session = activeSessions.get(customer.username);
      return {
        ...customer,
        online: !!session,
        active_session_ip: session ? session.ip : undefined,
      };
    });

    if (filters.onlineStatus) {
      const isOnline = filters.onlineStatus === "online";
      allData = allData.filter((item) => item.online === isOnline);
    }

    const recordsFilteredCount = allData.length;

    if (sortBy) {
      allData.sort((a, b) => {
        const key = sortBy as keyof MixRadiusCustomer;
        const valA = a[key];
        const valB = b[key];

        if (
          sortBy === "expired_on" ||
          sortBy === "renewed_on" ||
          sortBy === "created_at"
        ) {
          const dateA = valA ? new Date(String(valA)).getTime() : 0;
          const dateB = valB ? new Date(String(valB)).getTime() : 0;
          return sortDir === "asc" ? dateA - dateB : dateB - dateA;
        }

        const strA = String(valA || "").toLowerCase();
        const strB = String(valB || "").toLowerCase();
        if (strA < strB) return sortDir === "asc" ? -1 : 1;
        if (strA > strB) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    } else if (filters.authStatus === "Isolir") {
      allData.sort((a, b) => {
        const dateA = a.expired_on ? new Date(a.expired_on).getTime() : 0;
        const dateB = b.expired_on ? new Date(b.expired_on).getTime() : 0;
        return dateA - dateB;
      });
    }

    return {
      result: {
        draw: 1,
        recordsTotal: totalRecordsFromUpstream,
        recordsFiltered: recordsFilteredCount,
        data: allData.slice(start, start + length),
      },
      cache: nextCache,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    logger.error("[MixRadius] Fetch error:", message);

    if (
      error instanceof MixRadiusConfigError ||
      isMixRadiusConfigError(message)
    ) {
      throw error instanceof MixRadiusConfigError
        ? error
        : new MixRadiusConfigError(message);
    }

    throw new Error(`Failed to fetch MixRadius customers: ${message}`);
  }
}

export async function fetchMixRadiusCustomerDetail(
  params: MixRadiusCustomerClientParams & {
    customerId: string;
    fetchCustomersPPP: (
      params: FetchCustomersParams,
    ) => Promise<MixRadiusCustomerResponse>;
  },
): Promise<MixRadiusCustomerDetail> {
  const {
    client,
    baseUrl,
    login,
    onSessionExpired,
    randomDelay,
    customerId,
    fetchCustomersPPP,
  } = params;

  try {
    await login();
    await randomDelay(200, 600);

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

    if (html.includes("LOGIN</title>") || html.includes("rad-admin/post")) {
      onSessionExpired();
      throw new Error("Session expired, please refresh");
    }

    if (
      html.includes("404 - Data Not Found") ||
      html.includes("Data tidak ditemukan")
    ) {
      logger.error(
        `[MixRadius] 404 Not Found for ID ${customerId}. URL: ${baseUrl}/rad-customers/edit/${customerId}`,
      );

      if (customerId.length > 6 && /^\d+$/.test(customerId)) {
        try {
          const searchResult = await fetchCustomersPPP({
            start: 0,
            length: 1,
            search: customerId,
            searchType: "username",
          });

          if (searchResult.data && searchResult.data.length > 0) {
            const user = searchResult.data[0];
            if (user.id && user.id !== customerId) {
              return fetchMixRadiusCustomerDetail({
                ...params,
                customerId: user.id,
              });
            }
          }
        } catch (resolveError) {
          logger.error("[MixRadius] ID resolution failed:", resolveError);
        }
      }

      throw new Error(
        "Data pelanggan tidak ditemukan (404). ID mungkin salah atau data telah dihapus.",
      );
    }

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

    const extractValue = (name: string): string => {
      const inputTagRegex = new RegExp(`<input[^>]*name="${name}"[^>]*>`, "i");
      const inputMatch = html.match(inputTagRegex);

      if (inputMatch) {
        const inputTag = inputMatch[0];
        const valueRegex = /value=['"]([^'"]*)['"]/i;
        const valueMatch = inputTag.match(valueRegex);
        if (valueMatch) return valueMatch[1] ?? "";
      }
      return "";
    };

    const extractTextarea = (name: string): string => {
      const regex = new RegExp(`name="${name}"[^>]*>([^<]*)</textarea>`, "i");
      const match = html.match(regex);
      return match ? (match[1] ?? "") : "";
    };

    const extractSelect = (name: string): string => {
      const selectBlockRegex = new RegExp(
        `<select[^>]*name="${name}"[^>]*>([\\s\\S]*?)</select>`,
        "i",
      );
      const selectBlockMatch = html.match(selectBlockRegex);

      if (selectBlockMatch) {
        const selectContent = selectBlockMatch[1] ?? "";
        const selectedOptionRegex =
          /<option[^>]*selected[^>]*>([\s\S]*?)<\/option>/i;
        const match = selectContent.match(selectedOptionRegex);
        if (match) return (match[1] ?? "").replace(/<[^>]*>/g, "").trim();

        const valueMatch = selectContent.match(
          /<option[^>]*value="([^"]*)"[^>]*selected[^>]*>([\s\S]*?)<\/option>/i,
        );
        if (valueMatch)
          return (valueMatch[2] ?? "").replace(/<[^>]*>/g, "").trim();
      }
      return "";
    };

    const extractSelectValue = (name: string): string => {
      const selectBlockRegex = new RegExp(
        `<select[^>]*name="${name}"[^>]*>([\\s\\S]*?)</select>`,
        "i",
      );
      const selectBlockMatch = html.match(selectBlockRegex);

      if (selectBlockMatch) {
        const selectContent = selectBlockMatch[1] ?? "";
        const valueRegex = /<option[^>]*value=['"]([^'"]*)['"][^>]*selected/i;
        const valueMatch = selectContent.match(valueRegex);
        if (valueMatch) return valueMatch[1] ?? "";

        const valueRegex2 = /<option[^>]*selected[^>]*value=['"]([^'"]*)['"]/i;
        const valueMatch2 = selectContent.match(valueRegex2);
        if (valueMatch2) return valueMatch2[1] ?? "";
      }
      return "";
    };

    const extractRadio = (name: string): string => {
      const regex = new RegExp(
        `input[^>]*name="${name}"[^>]*value="([^"]*)"[^>]*checked`,
        "i",
      );
      const match = html.match(regex);
      return match ? (match[1] ?? "") : "";
    };

    const customerDetail: MixRadiusCustomerDetail = {
      id: customerId,
      member_id: extractValue("memberId"),
      username: extractValue("username"),
      password: extractValue("password"),
      fullname: extractValue("fullname"),
      email: extractValue("email"),
      phonenumber: extractValue("phonenumber"),
      address: extractTextarea("address"),
      remote_address: extractValue("remote_address") || "Automatic",
      plan_name: extractSelect("id_plan"),
      payment_type: extractSelectValue("payment_type") || "POSTPAID",
      subscription_type: extractRadio("subscription_type") || "regular",
      trx_status: extractSelectValue("trx_status") || "UNPAID",
      identity_number: extractValue("identity_number"),
      created_at: "",
      renewed_on: extractValue("renewed_on"),
      expired_on: extractValue("expired_on"),
      auth_status:
        extractSelectValue("account_status") === "enabled"
          ? "Enabled-Users"
          : "Disabled-Users",
      note: extractValue("note"),
      bind_mac: extractSelectValue("bindmac"),
      mac_address:
        extractValue("callerid") ||
        (() => {
          const regex =
            /<i class="icon fa fa-server"><\/i>\s*([0-9A-Fa-f:]{12,17})/i;
          const match = html.match(regex);
          return match ? (match[1] ?? "").trim() : "";
        })(),
      total: "",
      latitude: extractValue("latitude"),
      longitude: extractValue("longitude"),
      odp_name: extractSelect("odp_id"),
      owner_name: extractSelect("owner").replace(/^Saat ini\s*:\s*/i, ""),
      service_type: extractSelect("nasporttype"),
      ip_type: extractSelect("ip_address_type"),
      portal_password: extractValue("portalpassword"),
      expired_action: extractSelect("expired_action"),
      invoices: parseMixRadiusInvoicesFromHtml(html),
      online: /Perangkat\s*\(\s*<b>\s*online\s*<\/b>\s*\)/i.test(html),
      uptime: (() => {
        const regex =
          /<i class="icon fa fa-calendar"><\/i>\s*([^<]+)\s*<\/h4>\s*Waktu Online/i;
        const match = html.match(regex);
        return match ? (match[1] ?? "").trim() : "";
      })(),
      quota_usage: (() => {
        const regex =
          /<i class="icon fa fa-area-chart"><\/i>\s*([^<]+)\s*<\/h4>\s*Quota Terpakai/i;
        const match = html.match(regex);
        return match ? (match[1] ?? "").trim() : "";
      })(),
    };

    if (!customerDetail.username && !customerDetail.member_id) {
      logger.error(
        `[MixRadius] Scraping Validation Failed for ID ${customerId}. HTML snippet: ${html.substring(0, 500)}...`,
      );
      throw new Error(
        "Integration Error: MixRadius Admin Panel layout may have changed. Failed to extract core customer data.",
      );
    }

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

export async function fetchMixRadiusInvoiceCounts(params: {
  customerIds: string[];
  bypassCache?: boolean;
  validationData?: Record<string, string>;
  invoiceCountCache: LRUCache<
    string,
    { paidCount: number; totalCount: number; lastRenewedOn: string }
  >;
  randomDelay: (min?: number, max?: number) => Promise<void>;
  login: () => Promise<void>;
  fetchCustomerDetail: (customerId: string) => Promise<MixRadiusCustomerDetail>;
}): Promise<Map<string, { paidCount: number; totalCount: number }>> {
  const {
    customerIds,
    bypassCache = false,
    validationData = {},
    invoiceCountCache,
    randomDelay,
    login,
    fetchCustomerDetail,
  } = params;

  try {
    await login();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      error instanceof MixRadiusConfigError ||
      isMixRadiusConfigError(message)
    ) {
      throw error instanceof MixRadiusConfigError
        ? error
        : getCustomerConfigError(message, "fetchInvoiceCounts");
    }
    throw error;
  }

  const results = new Map<string, { paidCount: number; totalCount: number }>();
  const chunkSize = 1;

  for (let i = 0; i < customerIds.length; i += chunkSize) {
    const chunk = customerIds.slice(i, i + chunkSize);

    const promises = chunk.map(async (id) => {
      try {
        const lastRenewedOn = validationData[id] || "";

        if (!bypassCache) {
          const cacheKey = buildInvoiceCountCacheKey(id, lastRenewedOn);
          const cached = invoiceCountCache.get(cacheKey);
          const liveRenewedOn = validationData[id];

          if (
            cached &&
            (!liveRenewedOn || cached.lastRenewedOn === liveRenewedOn)
          ) {
            results.set(id, {
              paidCount: cached.paidCount,
              totalCount: cached.totalCount,
            });
            return;
          }
        }

        await randomDelay(300, 1000);
        const detail = await fetchCustomerDetail(id);
        const invoices = detail.invoices || [];
        const paidCount = invoices.filter(
          (invoice) => invoice.status === "Paid",
        ).length;
        const totalCount = invoices.length;
        const counts = { paidCount, totalCount };
        results.set(id, counts);

        const cacheKey = buildInvoiceCountCacheKey(id, lastRenewedOn);
        invoiceCountCache.set(cacheKey, { ...counts, lastRenewedOn });
      } catch (error) {
        logger.error(
          `[MixRadius] Failed to fetch invoice count for ${id}:`,
          error,
        );
        results.set(id, { paidCount: 0, totalCount: 0 });
      }
    });

    await Promise.all(promises);

    if (i + chunkSize < customerIds.length) {
      await randomDelay(200, 500);
    }
  }

  return results;
}
