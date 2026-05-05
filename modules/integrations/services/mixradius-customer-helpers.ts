import type {
  MixRadiusCustomer,
  MixRadiusCustomerDetail,
  MixRadiusCustomerResponse,
} from "./mixradius-types";
import { applyCustomerFilters } from "./mixradius-customer-filters";
import { parseCustomerDetailHtml } from "./mixradius-customer-detail.parser";

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

export { applyCustomerFilters, parseCustomerDetailHtml };
export type { MixRadiusCustomerDetail };

/** Build upstream form payload for MixRadius customer fetch. */
export function buildCustomerFetchFormData(): URLSearchParams {
  const formData = new URLSearchParams();
  appendBasicFormFields(formData);
  appendColumnFields(formData);
  appendSearchAndOrderFields(formData);
  return formData;
}

function appendBasicFormFields(formData: URLSearchParams) {
  formData.append("draw", DEFAULT_DRAW);
  formData.append("start", DEFAULT_START);
  formData.append("length", DEFAULT_FETCH_LIMIT);
}

function appendColumnFields(formData: URLSearchParams) {
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
}

function appendSearchAndOrderFields(formData: URLSearchParams) {
  formData.append("search[value]", "");
  formData.append("search[regex]", "false");
  formData.append("order[0][column]", DEFAULT_ORDER_COLUMN);
  formData.append("order[0][dir]", DEFAULT_ORDER_DIRECTION);
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
