import type { AxiosInstance } from "axios";

import type {
  FetchCustomersParams,
  MixRadiusIncomePeriodRecord,
  MixRadiusIncomePeriodResponse,
} from "./mixradius-types";

const INCOME_BATCH_SIZE = 2500;
const FIRST_BATCH_START = 0;
const DEFAULT_DRAW_INDEX = 1;
const DATE_START_SUFFIX = " 00:00:01";
const DATE_END_SUFFIX = " 23:59:59";

const INCOME_COLUMNS = [
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
] as const;

/** Fetch all income pages from MixRadius upstream. */
export async function fetchAllIncomePeriodData(params: {
  client: AxiosInstance;
  baseUrl: string;
  filters: FetchCustomersParams;
  onSessionExpired: () => void;
}): Promise<{ records: MixRadiusIncomePeriodRecord[]; recordsTotal: number }> {
  const state = initializeFetchState();

  while (shouldContinueFetching(state)) {
    const batch = await fetchIncomeBatch({
      client: params.client,
      baseUrl: params.baseUrl,
      filters: params.filters,
      start: state.currentStart,
      onSessionExpired: params.onSessionExpired,
    });

    if (!batch || batch.data.length === 0) break;

    updateFetchState(state, batch);
  }

  return { records: state.allRecords, recordsTotal: state.recordsTotal };
}

function initializeFetchState() {
  return {
    allRecords: [] as MixRadiusIncomePeriodRecord[],
    currentStart: FIRST_BATCH_START,
    recordsTotal: 0,
    recordsFiltered: 0,
  };
}

function shouldContinueFetching(state: {
  allRecords: MixRadiusIncomePeriodRecord[];
  recordsFiltered: number;
  currentStart: number;
}) {
  if (state.currentStart === FIRST_BATCH_START) return true;
  if (state.recordsFiltered === 0) return false;
  return state.allRecords.length < state.recordsFiltered;
}

function updateFetchState(
  state: ReturnType<typeof initializeFetchState>,
  batch: {
    data: MixRadiusIncomePeriodRecord[];
    recordsTotal: number;
    recordsFiltered: number;
  },
) {
  if (state.currentStart === FIRST_BATCH_START) {
    state.recordsTotal = batch.recordsTotal;
    state.recordsFiltered = batch.recordsFiltered;
  }
  state.allRecords = state.allRecords.concat(batch.data);
  state.currentStart += INCOME_BATCH_SIZE;
}

async function fetchIncomeBatch(params: {
  client: AxiosInstance;
  baseUrl: string;
  filters: FetchCustomersParams;
  start: number;
  onSessionExpired: () => void;
}) {
  const responseData = await postIncomeBatch({
    client: params.client,
    baseUrl: params.baseUrl,
    filters: params.filters,
    start: params.start,
  });
  if (isSessionExpiredResponse(responseData)) {
    params.onSessionExpired();
    throw new Error("Session expired, please refresh");
  }
  return responseData as MixRadiusIncomePeriodResponse;
}

async function postIncomeBatch(params: {
  client: AxiosInstance;
  baseUrl: string;
  filters: FetchCustomersParams;
  start: number;
}) {
  const { client, baseUrl, filters, start } = params;
  const response = await client.post(
    `${baseUrl}/rad-get-data/reports-period`,
    buildIncomeFetchFormData(filters, start).toString(),
    buildIncomeRequestConfig(baseUrl),
  );
  return response.data;
}

function buildIncomeRequestConfig(baseUrl: string) {
  return {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, text/javascript, */*; q=0.01",
      Referer: `${baseUrl}/rad-reports/income-by-period`,
      Origin: baseUrl,
    },
  };
}

function buildIncomeFetchFormData(
  filters: FetchCustomersParams,
  start: number,
) {
  const formData = new URLSearchParams();
  formData.append(
    "draw",
    String(Math.floor(start / INCOME_BATCH_SIZE + DEFAULT_DRAW_INDEX)),
  );
  formData.append("start", String(start));
  formData.append("length", String(INCOME_BATCH_SIZE));
  appendDateFilters(formData, filters);
  formData.append("stype", "");
  formData.append("payment_method", "");
  formData.append("owner_id", "");
  formData.append("usertype", "0");
  INCOME_COLUMNS.forEach((column, index) =>
    appendIncomeColumn(formData, column, index),
  );
  formData.append("order[0][column]", "10");
  formData.append("order[0][dir]", "desc");
  formData.append("search[value]", "");
  formData.append("search[regex]", "false");
  return formData;
}

function appendDateFilters(
  formData: URLSearchParams,
  filters: FetchCustomersParams,
) {
  if (filters.startDate) {
    formData.append(
      "fdate",
      filters.startDate.includes(" ")
        ? filters.startDate
        : `${filters.startDate}${DATE_START_SUFFIX}`,
    );
  }
  if (filters.endDate) {
    formData.append(
      "tdate",
      filters.endDate.includes(" ")
        ? filters.endDate
        : `${filters.endDate}${DATE_END_SUFFIX}`,
    );
  }
}

function appendIncomeColumn(
  formData: URLSearchParams,
  column: (typeof INCOME_COLUMNS)[number],
  index: number,
) {
  formData.append(`columns[${index}][data]`, column.data);
  formData.append(`columns[${index}][name]`, "");
  formData.append(
    `columns[${index}][searchable]`,
    column.searchable ? "true" : "false",
  );
  formData.append(
    `columns[${index}][orderable]`,
    column.orderable ? "true" : "false",
  );
  formData.append(`columns[${index}][search][value]`, "");
  formData.append(`columns[${index}][search][regex]`, "false");
}

function isSessionExpiredResponse(responseData: unknown) {
  return typeof responseData === "string" && responseData.includes("<!DOCTYPE");
}
