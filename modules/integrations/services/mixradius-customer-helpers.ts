import { MixRadiusOwnerGroupFacadeService } from "./MixRadiusOwnerGroupFacadeService";
import {
  buildMixRadiusOwnerLookup,
  isMixRadiusOwnerAllowed,
  normalizeMixRadiusOwnerName,
} from "@/modules/integrations/services/mixradius-owner-normalizer";

import { sortCustomers } from "./mixradius-customer-sort";
import type {
  FetchCustomersParams,
  MixRadiusCustomer,
  MixRadiusCustomerDetail,
  MixRadiusCustomerResponse,
} from "./mixradius-types";

const MIXRADIUS_CUSTOMER_COLUMNS = [
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
] as const;
const DEFAULT_DRAW = "1";
const DEFAULT_START = "0";
const DEFAULT_FETCH_LIMIT = "10000";
const DEFAULT_ORDER_COLUMN = "8";
const DEFAULT_ORDER_DIRECTION = "desc";
const DEFAULT_SESSION_IP: undefined = undefined;
const ownerGroupService = new MixRadiusOwnerGroupFacadeService();

/** Build upstream form payload for MixRadius customer fetch. */
export function buildCustomerFetchFormData(): URLSearchParams {
  const formData = new URLSearchParams();
  formData.append("draw", DEFAULT_DRAW);
  formData.append("start", DEFAULT_START);
  formData.append("length", DEFAULT_FETCH_LIMIT);
  MIXRADIUS_CUSTOMER_COLUMNS.forEach((column, index) => {
    formData.append(`columns[${index}][data]`, column.data);
    formData.append(`columns[${index}][name]`, "");
    formData.append(
      `columns[${index}][searchable]`,
      column.searchable ? "true" : "false",
    );
    formData.append(`columns[${index}][orderable]`, "true");
    formData.append(`columns[${index}][search][value]`, "");
    formData.append(`columns[${index}][search][regex]`, "false");
  });
  formData.append("search[value]", "");
  formData.append("search[regex]", "false");
  formData.append("order[0][column]", DEFAULT_ORDER_COLUMN);
  formData.append("order[0][dir]", DEFAULT_ORDER_DIRECTION);
  return formData;
}

/** Deduplicate customer rows returned by MixRadius. */
export function deduplicateCustomers(
  rawData: MixRadiusCustomer[],
): MixRadiusCustomer[] {
  const uniqueCustomers = new Map<string, MixRadiusCustomer>();
  rawData.forEach((customer) => {
    if (!customer.username || uniqueCustomers.has(customer.username)) {
      return;
    }

    const candidate = customer as MixRadiusCustomer & { DT_RowId?: string };
    if (candidate.id && candidate.id.length > 8 && candidate.DT_RowId) {
      customer.id = String(candidate.DT_RowId).replace("row_", "");
    }

    uniqueCustomers.set(customer.username, customer);
  });
  return Array.from(uniqueCustomers.values());
}

/** Apply all supported customer filters in a deterministic order. */
export async function applyCustomerFilters(
  customers: MixRadiusCustomer[],
  filters: FetchCustomersParams,
): Promise<MixRadiusCustomer[]> {
  let filteredCustomers = customers;
  filteredCustomers = await filterBySite(filteredCustomers, filters.siteId);
  filteredCustomers = filterByAuthStatus(filteredCustomers, filters.authStatus);
  filteredCustomers = filterBySearch(
    filteredCustomers,
    filters.search,
    filters.searchType,
  );
  filteredCustomers = await filterByGroup(filteredCustomers, filters.groupId);
  filteredCustomers = filterByOwnerName(filteredCustomers, filters.ownerName);
  filteredCustomers = filterByOnlineStatus(
    filteredCustomers,
    filters.onlineStatus,
  );
  return sortCustomers(filteredCustomers, filters);
}

/** Merge active session data into customer rows. */
export function mergeCustomerSessions(
  customers: MixRadiusCustomer[],
  activeSessions: Map<string, { ip: string; uptime: string }>,
): MixRadiusCustomer[] {
  return customers.map((customer) => {
    const activeSession = activeSessions.get(customer.username);
    return {
      ...customer,
      online: Boolean(activeSession),
      active_session_ip: activeSession ? activeSession.ip : DEFAULT_SESSION_IP,
    };
  });
}

/** Build MixRadius customer response payload. */
export function buildCustomerResponse(params: {
  customers: MixRadiusCustomer[];
  start: number;
  length: number;
  recordsTotal: number;
}): MixRadiusCustomerResponse {
  const { customers, start, length, recordsTotal } = params;
  return {
    draw: 1,
    recordsTotal,
    recordsFiltered: customers.length,
    data: customers.slice(start, start + length),
  };
}

/** Parse customer detail HTML into DTO. */
export function parseCustomerDetailHtml(
  html: string,
  customerId: string,
): MixRadiusCustomerDetail {
  return {
    id: customerId,
    member_id: extractValue(html, "memberId"),
    username: extractValue(html, "username"),
    password: extractValue(html, "password"),
    fullname: extractValue(html, "fullname"),
    email: extractValue(html, "email"),
    phonenumber: extractValue(html, "phonenumber"),
    address: extractTextarea(html, "address"),
    remote_address: extractValue(html, "remote_address") || "Automatic",
    plan_name: extractSelectedLabel(html, "id_plan"),
    payment_type: extractSelectedValue(html, "payment_type") || "POSTPAID",
    subscription_type:
      extractCheckedRadioValue(html, "subscription_type") || "regular",
    trx_status: extractSelectedValue(html, "trx_status") || "UNPAID",
    identity_number: extractValue(html, "identity_number"),
    created_at: "",
    renewed_on: extractValue(html, "renewed_on"),
    expired_on: extractValue(html, "expired_on"),
    auth_status:
      extractSelectedValue(html, "account_status") === "enabled"
        ? "Enabled-Users"
        : "Disabled-Users",
    note: extractValue(html, "note"),
    bind_mac: extractSelectedValue(html, "bindmac"),
    mac_address: extractMacAddress(html),
    total: "",
    latitude: extractValue(html, "latitude"),
    longitude: extractValue(html, "longitude"),
    odp_name: extractSelectedLabel(html, "odp_id"),
    owner_name: extractSelectedLabel(html, "owner").replace(
      /^Saat ini\s*:\s*/i,
      "",
    ),
    service_type: extractSelectedLabel(html, "nasporttype"),
    ip_type: extractSelectedLabel(html, "ip_address_type"),
    portal_password: extractValue(html, "portalpassword"),
    expired_action: extractSelectedLabel(html, "expired_action"),
    invoices: [],
    online: /Perangkat\s*\(\s*<b>\s*online\s*<\/b>\s*\)/i.test(html),
    uptime: extractMetric(
      html,
      /<i class="icon fa fa-calendar"><\/i>\s*([^<]+)\s*<\/h4>\s*Waktu Online/i,
    ),
    quota_usage: extractMetric(
      html,
      /<i class="icon fa fa-area-chart"><\/i>\s*([^<]+)\s*<\/h4>\s*Quota Terpakai/i,
    ),
  };
}

function filterBySearch(
  customers: MixRadiusCustomer[],
  search?: string,
  searchType?: string,
) {
  if (!search) {
    return customers;
  }

  const normalizedSearch = search.toLowerCase();
  if (searchType === "all" || !searchType) {
    return customers.filter((customer) =>
      matchesAnyCustomerField(customer, normalizedSearch),
    );
  }

  return customers.filter((customer) => {
    const fieldValue = (customer as unknown as Record<string, unknown>)[
      searchType
    ];
    return (
      Boolean(fieldValue) &&
      String(fieldValue).toLowerCase().includes(normalizedSearch)
    );
  });
}

function matchesAnyCustomerField(
  customer: MixRadiusCustomer,
  normalizedSearch: string,
) {
  return [
    customer.fullname,
    customer.username,
    customer.member_id,
    customer.address,
    customer.phonenumber,
    customer.owner_name,
  ].some((value) => value?.toLowerCase().includes(normalizedSearch));
}

function filterByAuthStatus(
  customers: MixRadiusCustomer[],
  authStatus?: string,
) {
  if (!authStatus) {
    return customers;
  }

  if (authStatus === "Isolir") {
    return customers.filter(isExpiredCustomer);
  }

  if (authStatus === "Disabled-Users") {
    return customers.filter(isDisabledOrExpiredCustomer);
  }

  return customers.filter((customer) => customer.auth_status === authStatus);
}

function isExpiredCustomer(customer: MixRadiusCustomer) {
  const expiredDate = customer.expired_on
    ? new Date(customer.expired_on)
    : null;
  return (
    Boolean(expiredDate) &&
    !Number.isNaN(expiredDate.getTime()) &&
    expiredDate < new Date()
  );
}

function isDisabledOrExpiredCustomer(customer: MixRadiusCustomer) {
  if (["Disabled-Users", "disabled"].includes(customer.auth_status)) {
    return true;
  }
  return isExpiredCustomer(customer);
}

async function filterBySite(customers: MixRadiusCustomer[], siteId?: string) {
  if (!siteId) {
    return customers;
  }

  const siteOwners = await ownerGroupService.getOwnersBySiteId(siteId);
  const allowedOwners = buildMixRadiusOwnerLookup(siteOwners);
  return customers.filter((customer) =>
    isMixRadiusOwnerAllowed(customer.owner_name, allowedOwners),
  );
}

async function filterByGroup(customers: MixRadiusCustomer[], groupId?: string) {
  if (!groupId) {
    return customers;
  }

  const groupOwners = await ownerGroupService.getOwnersByGroupId(groupId);
  if (!groupOwners) {
    return [];
  }

  if (groupOwners.length === 0) {
    return [];
  }

  const allowedOwners = buildMixRadiusOwnerLookup(groupOwners);
  return customers.filter((customer) =>
    isMixRadiusOwnerAllowed(customer.owner_name, allowedOwners),
  );
}

function filterByOwnerName(customers: MixRadiusCustomer[], ownerName?: string) {
  if (!ownerName) {
    return customers;
  }

  const normalizedOwner = normalizeMixRadiusOwnerName(ownerName);
  return customers.filter((customer) => {
    if (!customer.owner_name) {
      return false;
    }
    const candidateOwner = normalizeMixRadiusOwnerName(customer.owner_name);
    return (
      candidateOwner.full === normalizedOwner.full ||
      candidateOwner.prefix === normalizedOwner.prefix
    );
  });
}

function filterByOnlineStatus(
  customers: MixRadiusCustomer[],
  onlineStatus?: "online" | "offline",
) {
  if (!onlineStatus) {
    return customers;
  }

  const isOnline = onlineStatus === "online";
  return customers.filter((customer) => customer.online === isOnline);
}

function extractValue(html: string, name: string) {
  const inputMatch = html.match(
    new RegExp(`<input[^>]*name="${name}"[^>]*>`, "i"),
  );
  const valueMatch = inputMatch?.[0].match(/value=['"]([^'"]*)['"]/i);
  return valueMatch?.[1] ?? "";
}

function extractTextarea(html: string, name: string) {
  return (
    html.match(
      new RegExp(`name="${name}"[^>]*>([^<]*)</textarea>`, "i"),
    )?.[1] ?? ""
  );
}

function extractSelectedLabel(html: string, name: string) {
  const selectContent = extractSelectContent(html, name);
  const selectedLabel = selectContent.match(
    /<option[^>]*selected[^>]*>([\s\S]*?)<\/option>/i,
  )?.[1];
  if (selectedLabel) {
    return selectedLabel.replace(/<[^>]*>/g, "").trim();
  }

  const selectedByValue = selectContent.match(
    /<option[^>]*value="([^"]*)"[^>]*selected[^>]*>([\s\S]*?)<\/option>/i,
  )?.[2];
  return selectedByValue?.replace(/<[^>]*>/g, "").trim() ?? "";
}

function extractSelectedValue(html: string, name: string) {
  const selectContent = extractSelectContent(html, name);
  return (
    selectContent.match(
      /<option[^>]*value=['"]([^'"]*)['"][^>]*selected/i,
    )?.[1] ??
    selectContent.match(
      /<option[^>]*selected[^>]*value=['"]([^'"]*)['"]/i,
    )?.[1] ??
    ""
  );
}

function extractSelectContent(html: string, name: string) {
  return (
    html.match(
      new RegExp(`<select[^>]*name="${name}"[^>]*>([\\s\\S]*?)</select>`, "i"),
    )?.[1] ?? ""
  );
}

function extractCheckedRadioValue(html: string, name: string) {
  return (
    html.match(
      new RegExp(
        `input[^>]*name="${name}"[^>]*value="([^"]*)"[^>]*checked`,
        "i",
      ),
    )?.[1] ?? ""
  );
}

function extractMacAddress(html: string) {
  return (
    extractValue(html, "callerid") ||
    extractMetric(
      html,
      /<i class="icon fa fa-server"><\/i>\s*([0-9A-Fa-f:]{12,17})/i,
    )
  );
}

function extractMetric(html: string, regex: RegExp) {
  return html.match(regex)?.[1]?.trim() ?? "";
}
