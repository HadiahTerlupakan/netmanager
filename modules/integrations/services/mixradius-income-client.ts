import { prismaBilling } from "@/lib/prisma-billing";
import type { AxiosInstance } from "axios";

import {
  DUITKU_DEFAULT_FEES,
  normalizePaymentMethod,
} from "@/modules/integrations/constants/DuitkuDefaults";
import {
  buildMixRadiusAllowedOwners,
  normalizeMixRadiusOwnerName,
} from "../utils/mixradius-owner-matching";

import {
  MixRadiusConfigError,
  type FetchCustomersParams,
  type MixRadiusIncomePeriodRecord,
  type MixRadiusIncomePeriodResponse,
  type MixRadiusIncomeSummary,
  type MixRadiusOwner,
} from "./MixRadiusService";

type MixRadiusIncomeClientParams = {
  client: AxiosInstance;
  baseUrl: string;
  login: () => Promise<void>;
  onSessionExpired: () => void;
  randomDelay: (min?: number, max?: number) => Promise<void>;
};

type MixRadiusProfitReport = {
  income: number[];
  transactions: number[];
  sellerFees: number[];
  taxes: number[];
};

function isMixRadiusConfigError(message: string) {
  return (
    message.includes("konfigurasi") ||
    message.includes("valid") ||
    message.includes("Missing credentials")
  );
}

function parseIncomeValue(value: string | number | undefined): number {
  if (!value) return 0;
  if (typeof value === "number") return value;

  let str = String(value).trim();
  str = str.replace(/Rp\.?\s?/i, "");
  str = str.replace(/,/g, "");

  return parseFloat(str) || 0;
}

function parseLocalizedValue(value: string | number | undefined): number {
  if (!value) return 0;

  let str = String(value).trim();
  str = str.replace(/Rp\.?\s?/i, "");

  if (str.includes(",")) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if ((str.match(/\./g) || []).length > 1) {
    str = str.replace(/\./g, "");
  } else if (str.includes(".") && /^\d{1,3}(\.\d{3})+$/.test(str)) {
    str = str.replace(/\./g, "");
  }

  const clean = str.replace(/[^0-9.-]/g, "");
  return parseFloat(clean) || 0;
}

function formatIdr(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

function calculateInlineSummary(
  data: MixRadiusIncomePeriodRecord[],
): MixRadiusIncomeSummary {
  let totalProfit = 0;
  let totalFee = 0;
  let totalPlusPpn = 0;

  data.forEach((item) => {
    const total = parseIncomeValue(item.total);
    const fee = parseIncomeValue(item.seller_fee);
    const price = parseIncomeValue(item.price);
    const tax = parseIncomeValue(item.tax);

    totalPlusPpn += total;
    totalFee += fee;

    if (price > 0) {
      totalProfit += price;
    } else {
      totalProfit += total - tax - fee;
    }
  });

  return {
    profit: formatIdr(totalProfit),
    feeSeller: formatIdr(totalFee),
    totalPlusPpn: formatIdr(totalPlusPpn),
    totalTransactions: data.length.toString(),
  };
}

function calculateEstimatedSummary(
  data: MixRadiusIncomePeriodRecord[],
  recordsFiltered: number,
): MixRadiusIncomeSummary {
  let totalProfit = 0;
  let totalFee = 0;
  let totalPlusPpn = 0;

  data.forEach((item) => {
    const total = parseLocalizedValue(item.total);
    const price = parseLocalizedValue(item.price);
    const tax = parseLocalizedValue(item.tax);

    let estimatedFee = 0;
    const methodCode = normalizePaymentMethod(item.payment_method || "");
    if (methodCode && DUITKU_DEFAULT_FEES[methodCode]) {
      const feeConfig = DUITKU_DEFAULT_FEES[methodCode];
      if (feeConfig.type === "FIXED") {
        estimatedFee = feeConfig.value;
      } else if (feeConfig.type === "PERCENT") {
        estimatedFee = Math.ceil(total * (feeConfig.value / 100));
      }
    }

    totalPlusPpn += total;
    totalFee += estimatedFee;

    if (price > 0) {
      totalProfit += price - estimatedFee;
    } else {
      totalProfit += total - tax - estimatedFee;
    }
  });

  return {
    profit: formatIdr(totalProfit),
    feeSeller: formatIdr(totalFee),
    totalPlusPpn: formatIdr(totalPlusPpn),
    totalTransactions: recordsFiltered.toString(),
  };
}

function parseProfitArray(html: string, regex: RegExp): number[] {
  const match = html.match(regex);
  if (!match || !match[1]) return Array(12).fill(0);

  return match[1].split(",").map((value: string) => {
    const clean = value.replace(/['"]/g, "");
    return parseFloat(clean) || 0;
  });
}

export async function fetchMixRadiusIncomeByPeriod(
  params: MixRadiusIncomeClientParams & {
    filters?: FetchCustomersParams;
  },
): Promise<MixRadiusIncomePeriodResponse> {
  const {
    client,
    baseUrl,
    login,
    onSessionExpired,
    randomDelay,
    filters = {},
  } = params;
  const {
    start = 0,
    length = 10,
    search = "",
    sortBy = "renewed_on",
    sortDir = "desc",
    startDate,
    endDate,
    serviceType,
    paymentMethod,
    ownerId,
    groupId,
    siteId,
  } = filters;

  try {
    await login();
    await randomDelay(300, 800);

    let allFetchedData: MixRadiusIncomePeriodRecord[] = [];
    let currentStart = 0;
    const batchSize = 2500;
    let hasMore = true;

    let upstreamRecordsTotal = 0;
    let upstreamRecordsFiltered = 0;

    while (hasMore) {
      const formData = new URLSearchParams();
      formData.append(
        "draw",
        Math.floor(currentStart / batchSize + 1).toString(),
      );
      formData.append("start", currentStart.toString());
      formData.append("length", batchSize.toString());

      if (startDate) {
        const fdate = startDate.includes(" ")
          ? startDate
          : `${startDate} 00:00:01`;
        formData.append("fdate", fdate);
      }
      if (endDate) {
        const tdate = endDate.includes(" ") ? endDate : `${endDate} 23:59:59`;
        formData.append("tdate", tdate);
      }

      formData.append("stype", "");
      formData.append("payment_method", "");
      formData.append("owner_id", "");
      formData.append("usertype", "0");

      const columns = [
        { data: "id", searchable: false, orderable: false },
        { data: "id", searchable: false, orderable: true },
        { data: "invoice", searchable: true, orderable: true },
        { data: "member_id", searchable: true, orderable: true },
        { data: "username", searchable: true, orderable: true },
        { data: "fullname", searchable: true, orderable: true },
        { data: "nasporttype", searchable: false, orderable: true },
        { data: "plan_name", searchable: true, orderable: true },
        { data: "total", searchable: false, orderable: true },
        { data: "seller_fee", searchable: false, orderable: true },
        { data: "renewed_on", searchable: true, orderable: true },
        { data: "owner_name", searchable: true, orderable: true },
        { data: "price", searchable: false, orderable: false },
        { data: "tax", searchable: false, orderable: false },
        { data: "payment_method", searchable: true, orderable: true },
        { data: "payment_type", searchable: true, orderable: true },
        { data: "type", searchable: true, orderable: true },
        { data: "method", searchable: true, orderable: true },
        { data: "id", searchable: false, orderable: true },
      ];

      columns.forEach((col, idx) => {
        formData.append(`columns[${idx}][data]`, col.data);
        formData.append(`columns[${idx}][name]`, "");
        formData.append(
          `columns[${idx}][searchable]`,
          col.searchable ? "true" : "false",
        );
        formData.append(
          `columns[${idx}][orderable]`,
          col.orderable ? "true" : "false",
        );
        formData.append(`columns[${idx}][search][value]`, "");
        formData.append(`columns[${idx}][search][regex]`, "false");
      });

      formData.append("order[0][column]", "10");
      formData.append("order[0][dir]", "desc");
      formData.append("search[value]", "");
      formData.append("search[regex]", "false");

      const response = await client.post(
        `${baseUrl}/rad-get-data/reports-period`,
        formData.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            Accept: "application/json, text/javascript, */*; q=0.01",
            Referer: `${baseUrl}/rad-reports/income-by-period`,
            Origin: baseUrl,
          },
        },
      );

      if (
        typeof response.data === "string" &&
        response.data.includes("<!DOCTYPE")
      ) {
        onSessionExpired();
        return fetchMixRadiusIncomeByPeriod(params);
      }

      const responseData = response.data as MixRadiusIncomePeriodResponse;
      const pageData = responseData.data || [];

      if (currentStart === 0) {
        upstreamRecordsTotal = responseData.recordsTotal;
        upstreamRecordsFiltered = responseData.recordsFiltered;
      }

      if (pageData.length > 0) {
        allFetchedData = allFetchedData.concat(pageData);
        currentStart += batchSize;
      } else {
        hasMore = false;
      }

      if (
        allFetchedData.length >= upstreamRecordsFiltered &&
        upstreamRecordsFiltered > 0
      ) {
        hasMore = false;
      }
    }

    let allData = allFetchedData;
    const recordsTotal = upstreamRecordsTotal;

    if (startDate && endDate) {
      const startStr = startDate.includes(" ")
        ? startDate
        : `${startDate} 00:00:00`;
      const startTs = new Date(startStr).getTime();
      const endStr = endDate.includes(" ") ? endDate : `${endDate} 23:59:59`;
      const endTs = new Date(endStr).getTime();

      if (!Number.isNaN(startTs) && !Number.isNaN(endTs)) {
        allData = allData.filter((item) => {
          if (!item.renewed_on) return false;
          const itemTs = new Date(item.renewed_on).getTime();
          return itemTs >= startTs && itemTs <= endTs;
        });
      }
    }

    if (siteId) {
      const groups = await prismaBilling.mixRadiusOwnerGroup.findMany({
        where: { siteId },
        select: { owners: true },
      });
      const allowedOwners = buildMixRadiusAllowedOwners(
        groups.flatMap((group) => group.owners),
      );
      allData = allData.filter(
        (item) =>
          item.owner_name &&
          allowedOwners.has(item.owner_name.toLowerCase().trim()),
      );
    }

    if (groupId) {
      const group = await prismaBilling.mixRadiusOwnerGroup.findUnique({
        where: { id: groupId },
        select: { owners: true },
      });

      if (group?.owners) {
        const allowedOwners = buildMixRadiusAllowedOwners(group.owners);
        allData = allData.filter(
          (item) =>
            item.owner_name &&
            allowedOwners.has(item.owner_name.toLowerCase().trim()),
        );
      } else {
        allData = [];
      }
    }

    if (ownerId && ownerId !== "all") {
      const normalizedOwnerId = normalizeMixRadiusOwnerName(ownerId);

      allData = allData.filter((item) => {
        if (!item.owner_name) return false;
        const normalizedOwner = normalizeMixRadiusOwnerName(item.owner_name);
        return (
          normalizedOwner.full === normalizedOwnerId.full ||
          normalizedOwner.full === normalizedOwnerId.prefix
        );
      });
    }

    if (serviceType) {
      const typeUpper = serviceType.toUpperCase();
      allData = allData.filter((item) => {
        const itemType = (item.type || "").toUpperCase();
        const itemPlan = (item.plan_name || "").toUpperCase();
        const itemNasPort = (item.nasporttype || "").toUpperCase();

        const isPPP =
          itemType.includes("PPP") ||
          itemType.includes("PPPOE") ||
          itemPlan.includes("PPP") ||
          itemPlan.includes("HOME") ||
          itemPlan.includes("DEDICATED") ||
          itemPlan.includes("MB");

        const isHotspot =
          itemType.includes("HOTSPOT") ||
          itemType.includes("VOUCHER") ||
          itemPlan.includes("HOTSPOT") ||
          itemPlan.includes("VC") ||
          itemPlan.includes("VOUCHER");

        if (typeUpper === "PPP") {
          if (isPPP) return true;
          if (isHotspot) return false;
          return itemNasPort.includes("ETHERNET");
        }

        if (typeUpper === "HOTSPOT") {
          if (isHotspot) return true;
          if (isPPP) return false;
          return itemNasPort.includes("WIRELESS");
        }

        return true;
      });
    }

    if (paymentMethod) {
      const pm = paymentMethod.toLowerCase();
      allData = allData.filter((item) => {
        const method = (item.payment_method || item.method || "")
          .toLowerCase()
          .trim();
        const type = (item.payment_type || "").toLowerCase();
        const onlineKeywords = [
          "dtk",
          "tripay",
          "xendit",
          "midtrans",
          "doku",
          "ipaymu",
          "mayar",
          "faspay",
          "winpay",
          "auto",
        ];

        const isExplicitOnline = onlineKeywords.some(
          (keyword) => method.includes(keyword) || type.includes(keyword),
        );

        if (pm === "online") return isExplicitOnline;
        if (pm === "manual") return !isExplicitOnline;
        return true;
      });
    }

    if (search) {
      const lowerSearch = search.toLowerCase();
      allData = allData.filter(
        (item) =>
          (item.invoice && item.invoice.toLowerCase().includes(lowerSearch)) ||
          (item.username &&
            item.username.toLowerCase().includes(lowerSearch)) ||
          (item.fullname &&
            item.fullname.toLowerCase().includes(lowerSearch)) ||
          (item.member_id &&
            item.member_id.toLowerCase().includes(lowerSearch)) ||
          (item.owner_name &&
            item.owner_name.toLowerCase().includes(lowerSearch)),
      );
    }

    const recordsFilteredCount = allData.length;
    const summary = calculateInlineSummary(allData);

    if (sortBy) {
      allData.sort((a, b) => {
        const valA = (a as unknown as Record<string, unknown>)[sortBy];
        const valB = (b as unknown as Record<string, unknown>)[sortBy];

        if (sortBy === "renewed_on" || sortBy === "invoice_date") {
          const dateA = valA ? new Date(valA as string).getTime() : 0;
          const dateB = valB ? new Date(valB as string).getTime() : 0;
          return sortDir === "asc" ? dateA - dateB : dateB - dateA;
        }

        const strA = String(valA || "").toLowerCase();
        const strB = String(valB || "").toLowerCase();
        if (strA < strB) return sortDir === "asc" ? -1 : 1;
        if (strA > strB) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    const pagedData = allData.slice(start, start + length);

    return {
      draw: 1,
      recordsTotal,
      recordsFiltered: recordsFilteredCount,
      data: pagedData,
      summary,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";

    if (
      error instanceof MixRadiusConfigError ||
      isMixRadiusConfigError(message)
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

export async function fetchMixRadiusIncomeSummary(
  params: MixRadiusIncomeClientParams & {
    filters?: FetchCustomersParams;
  },
): Promise<MixRadiusIncomeSummary> {
  try {
    const result = await fetchMixRadiusIncomeByPeriod({
      ...params,
      filters: {
        ...params.filters,
        start: 0,
        length: 10000,
        search: "",
      },
    });

    if (result.summary) {
      return result.summary;
    }

    return calculateEstimatedSummary(result.data, result.recordsFiltered);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      error instanceof MixRadiusConfigError ||
      isMixRadiusConfigError(message)
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

    const html = response.data as string;
    const owners: MixRadiusOwner[] = [];
    const selectMatch = html.match(
      /<select[^>]*name="owner_id"[^>]*>([\s\S]*?)<\/select>/i,
    );

    if (selectMatch) {
      const optionsHtml = selectMatch[1];
      const optionRegex =
        /<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/gi;
      let match: RegExpExecArray | null;

      while ((match = optionRegex.exec(optionsHtml || "")) !== null) {
        const id = match[1];
        const name = match[2]?.trim() || "";

        if (id && id !== "0" && name) {
          owners.push({ id, name });
        }
      }
    }

    return owners.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      error instanceof MixRadiusConfigError ||
      isMixRadiusConfigError(message)
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

export async function fetchMixRadiusUniqueOwners(params: {
  fetchCustomersPPP: (
    filters: FetchCustomersParams,
  ) => Promise<{ data: Array<{ owner_name: string }> }>;
}): Promise<string[]> {
  try {
    const result = await params.fetchCustomersPPP({ start: 0, length: 10000 });

    if (!result.data || result.data.length === 0) {
      return [];
    }

    const owners = new Set<string>();
    result.data.forEach((item) => {
      if (item.owner_name) {
        owners.add(item.owner_name);
      }
    });

    return Array.from(owners).sort();
  } catch (error) {
    console.error(
      "[MixRadius] Get owners error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

export async function deleteMixRadiusIncomeRecord(
  params: MixRadiusIncomeClientParams & {
    id: string;
  },
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
      isMixRadiusConfigError(message)
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

    if (isMixRadiusConfigError(message)) {
      console.warn(
        `[MixRadius] Integration not available (getPrintInvoiceHtml): ${message}`,
      );
      return '<div style="padding:20px;text-align:center;"><h3>MixRadius Integration Not Configured</h3><p>Please configure MixRadius credentials in Settings.</p></div>';
    }

    console.error("[MixRadius] Get print HTML error:", message);
    throw new Error(`Failed to get print view: ${message}`);
  }
}

export async function fetchMixRadiusProfitReport(
  params: MixRadiusIncomeClientParams,
): Promise<MixRadiusProfitReport> {
  const { client, baseUrl, login } = params;

  try {
    await login();

    const response = await client.get(`${baseUrl}/rad-reports/profit-load`);
    const html = response.data as string;

    const incomeArray = parseProfitArray(html, /var\s+income\s*=\s*\[(.*?)\];/);

    let transactionArray = parseProfitArray(html, /var\s+trx\s*=\s*\[(.*?)\];/);
    if (transactionArray.every((value) => value === 0)) {
      transactionArray = parseProfitArray(
        html,
        /var\s+transaction\s*=\s*\[(.*?)\];/,
      );
    }
    if (transactionArray.every((value) => value === 0)) {
      transactionArray = parseProfitArray(html, /var\s+count\s*=\s*\[(.*?)\];/);
    }

    const sellerFeeArray = parseProfitArray(
      html,
      /var\s+sellerfee\s*=\s*\[(.*?)\];/,
    );
    const taxArray = parseProfitArray(html, /var\s+tax\s*=\s*\[(.*?)\];/);

    return {
      income: incomeArray,
      transactions: transactionArray,
      sellerFees: sellerFeeArray,
      taxes: taxArray,
    };
  } catch (error) {
    if (error instanceof MixRadiusConfigError) throw error;
    console.error("[MixRadius] Error fetching profit report:", error);
    return {
      income: Array(12).fill(0),
      transactions: Array(12).fill(0),
      sellerFees: Array(12).fill(0),
      taxes: Array(12).fill(0),
    };
  }
}
