import type {
  ParsedDateRange,
  SortOrder,
  UsageCustomerRecord,
  UsageSortBy,
  UsageSource,
} from "./pelanggan-ppp-route-helpers";

const BYTES_PER_GB = 1073741824;

export type CombinedUsageItem = {
  sessionStartTime: Date | string | null;
  sessionDuration: string;
  totalBytes: string;
};

export type RadiusHistoryItem = {
  radAcctId: string;
  acctSessionId?: string | null;
  acctStartTime: string | null;
  acctStopTime: string | null;
  acctSessionTime: string;
  acctInputOctets: string;
  acctOutputOctets: string;
  totalOctets: string;
  nasIpAddress?: string | null;
  framedIpAddress?: string | null;
};

export type DatabaseHistoryItem = {
  id: string;
  session_id: string | null;
  session_start_time: Date;
  session_end_time: Date | null;
  session_duration: bigint | null;
  upload_bytes: bigint | null;
  download_bytes: bigint | null;
  total_bytes: bigint | null;
  nas_ip_address: string | null;
  calling_station_id: string | null;
  called_station_id: string | null;
  terminate_cause: string | null;
};

/** Map item histori radius ke response. */
export function mapRadiusHistoryItem(item: RadiusHistoryItem) {
  return {
    ...mapRadiusHistoryIdentity(item),
    ...mapRadiusHistoryDuration(item),
    ...mapRadiusHistoryTraffic(item),
    ...mapRadiusHistoryNetwork(item),
    source: "radius" as const,
  };
}

/** Map item histori database ke response. */
export function mapDatabaseHistoryItem(usage: DatabaseHistoryItem) {
  const totalBytes = BigInt(usage.total_bytes ?? 0);
  return {
    ...mapDatabaseHistoryIdentity(usage),
    ...mapDatabaseHistoryDuration(usage),
    ...mapDatabaseHistoryTraffic(usage, totalBytes),
    ...mapDatabaseHistoryNetwork(usage),
    source: "database" as const,
  };
}

/** Urutkan histori usage gabungan. */
export function sortUsageHistory(
  combinedData: CombinedUsageItem[],
  sortBy: UsageSortBy,
  sortOrder: SortOrder,
) {
  return combinedData.sort((left, right) => {
    const leftValue = normalizeSortValue(left[sortBy]);
    const rightValue = normalizeSortValue(right[sortBy]);
    if (sortOrder === "asc") return leftValue > rightValue ? 1 : -1;
    return leftValue < rightValue ? 1 : -1;
  });
}

/** Bangun response histori pemakaian pelanggan. */
export function buildUsageHistoryResponse(input: {
  pelanggan: UsageCustomerRecord;
  pagination: { page: number; limit: number };
  source: UsageSource;
  dateRange: ParsedDateRange;
  combinedData: CombinedUsageItem[];
}) {
  const total = input.combinedData.length;
  const startIndex = (input.pagination.page - 1) * input.pagination.limit;
  return {
    success: true,
    customer: buildUsageCustomer(input.pelanggan),
    pagination: buildUsagePagination(input, total),
    filters: buildUsageFilters(input),
    data: input.combinedData.slice(
      startIndex,
      startIndex + input.pagination.limit,
    ),
  };
}

function mapRadiusHistoryIdentity(item: RadiusHistoryItem) {
  return {
    id: `radius-${item.radAcctId}`,
    sessionId: item.acctSessionId ?? null,
    sessionStartTime: item.acctStartTime,
    sessionEndTime: item.acctStopTime,
  };
}

function mapRadiusHistoryDuration(item: RadiusHistoryItem) {
  return {
    sessionDuration: item.acctSessionTime,
    sessionDurationMinutes: Number(item.acctSessionTime) / 60,
  };
}

function mapRadiusHistoryTraffic(item: RadiusHistoryItem) {
  return {
    uploadBytes: item.acctInputOctets,
    downloadBytes: item.acctOutputOctets,
    totalBytes: item.totalOctets,
    uploadGB: Number(item.acctInputOctets) / BYTES_PER_GB,
    downloadGB: Number(item.acctOutputOctets) / BYTES_PER_GB,
    totalGB: Number(item.totalOctets) / BYTES_PER_GB,
  };
}

function mapRadiusHistoryNetwork(item: RadiusHistoryItem) {
  return {
    nasIpAddress: item.nasIpAddress ?? null,
    callingStationId: null as string | null,
    calledStationId: null as string | null,
    terminateCause: null as string | null,
  };
}

function mapDatabaseHistoryIdentity(usage: DatabaseHistoryItem) {
  return {
    id: usage.id,
    sessionId: usage.session_id,
    sessionStartTime: usage.session_start_time,
    sessionEndTime: usage.session_end_time,
  };
}

function mapDatabaseHistoryDuration(usage: DatabaseHistoryItem) {
  return {
    sessionDuration: String(usage.session_duration ?? 0),
    sessionDurationMinutes: Number(usage.session_duration ?? 0) / 60,
  };
}

function mapDatabaseHistoryTraffic(
  usage: DatabaseHistoryItem,
  totalBytes: bigint,
) {
  return {
    uploadBytes: String(usage.upload_bytes ?? 0),
    downloadBytes: String(usage.download_bytes ?? 0),
    totalBytes: String(usage.total_bytes ?? 0),
    uploadGB: Number(usage.upload_bytes ?? 0) / BYTES_PER_GB,
    downloadGB: Number(usage.download_bytes ?? 0) / BYTES_PER_GB,
    totalGB: Number(totalBytes) / BYTES_PER_GB,
  };
}

function mapDatabaseHistoryNetwork(usage: DatabaseHistoryItem) {
  return {
    nasIpAddress: usage.nas_ip_address,
    callingStationId: usage.calling_station_id,
    calledStationId: usage.called_station_id,
    terminateCause: usage.terminate_cause,
  };
}

function buildUsageCustomer(pelanggan: UsageCustomerRecord) {
  return {
    id: pelanggan.id,
    idPelanggan: pelanggan.idPelanggan,
    nama: pelanggan.nama,
    username: pelanggan.username,
    status: pelanggan.status,
  };
}

function buildUsagePagination(
  input: { pagination: { page: number; limit: number } },
  total: number,
) {
  return {
    page: input.pagination.page,
    limit: input.pagination.limit,
    total,
    totalPages: Math.ceil(total / input.pagination.limit),
  };
}

function buildUsageFilters(input: {
  dateRange: ParsedDateRange;
  source: UsageSource;
}) {
  return {
    startDate: input.dateRange.startDate?.toISOString() || null,
    endDate: input.dateRange.endDate?.toISOString() || null,
    source: input.source,
  };
}

function normalizeSortValue(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? value : numberValue;
  }
  return value ?? 0;
}
