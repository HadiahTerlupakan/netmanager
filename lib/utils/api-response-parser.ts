/**
 * Standardized API Response Parser
 *
 * Handles both wrapped ({success, data}) and raw responses consistently.
 * Provides type-safe parsing for various response formats used across the application.
 */

/**
 * Standard API response structure
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
}

/**
 * API Error class for standardized error handling
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly errors?: Record<string, string[]> | undefined;

  constructor(
    message: string,
    status: number,
    errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

/**
 * Parse API response and extract data with proper error handling
 * Handles both wrapped and raw response formats
 *
 * @param response - Fetch Response object
 * @returns Parsed and unwrapped data
 * @throws ApiError if response is not ok or parsing fails
 *
 * @example
 * ```ts
 * const response = await fetch('/api/users')
 * const users = await parseApiResponse<User[]>(response)
 * ```
 */
export async function parseApiResponse<T>(response: Response): Promise<T> {
  // Check content type
  const contentType = response.headers.get("content-type");

  // Handle non-JSON responses
  if (!contentType?.includes("application/json")) {
    if (!response.ok) {
      throw new ApiError(
        `HTTP Error: ${response.status} ${response.statusText}`,
        response.status,
      );
    }
    // Return empty object for successful non-JSON responses
    return {} as T;
  }

  let json: unknown;

  try {
    json = await response.json();
  } catch {
    throw new ApiError("Gagal memproses respon JSON", response.status);
  }

  // Handle error responses
  if (!response.ok) {
    const errorData = json as Partial<ApiResponse<unknown>>;
    throw new ApiError(
      errorData.message || errorData.error || `HTTP Error: ${response.status}`,
      response.status,
      errorData.errors,
    );
  }

  // Unwrap and return data
  return unwrapData<T>(json);
}

/**
 * Extract data from various response formats
 * Handles: { data }, { data: { data } }, { users }, { items }, raw arrays, etc.
 *
 * @param data - Raw response data
 * @returns Unwrapped data
 *
 * @example
 * ```ts
 * // All of these return the same result:
 * unwrapData({ data: [1, 2, 3] })           // [1, 2, 3]
 * unwrapData({ data: { data: [1, 2, 3] } }) // [1, 2, 3]
 * unwrapData({ success: true, data: [1, 2, 3] }) // [1, 2, 3]
 * unwrapData([1, 2, 3])                     // [1, 2, 3]
 * ```
 */
export function unwrapData<T>(data: unknown): T {
  // Handle null/undefined
  if (data === null || data === undefined) {
    return data as T;
  }

  // Handle arrays directly
  if (Array.isArray(data)) {
    return data as T;
  }

  // Handle objects
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;

    // Check for standard wrapped response { success, data }
    if ("success" in obj && "data" in obj) {
      // Handle double-wrapped { success, data: { data } }
      if (
        obj.data !== null &&
        typeof obj.data === "object" &&
        !Array.isArray(obj.data) &&
        "data" in (obj.data as Record<string, unknown>)
      ) {
        return (obj.data as Record<string, unknown>).data as T;
      }
      return obj.data as T;
    }

    // Check for common data wrapper patterns
    const dataKeys = ["data", "users", "items", "results", "records", "list"];
    for (const key of dataKeys) {
      if (key in obj && obj[key] !== undefined) {
        // If it's the only meaningful key (besides metadata), return it
        const meaningfulKeys = Object.keys(obj).filter(
          (k) =>
            ![
              "success",
              "message",
              "pagination",
              "meta",
              "total",
              "page",
            ].includes(k),
        );
        if (meaningfulKeys.length === 1 && meaningfulKeys[0] === key) {
          return obj[key] as T;
        }
      }
    }

    // Check for single data key pattern
    if ("data" in obj) {
      return obj.data as T;
    }
  }

  // Return as-is if no wrapping detected
  return data as T;
}

/**
 * Parse paginated API response
 *
 * @param response - Fetch Response object
 * @returns Parsed paginated response with data and pagination metadata
 *
 * @example
 * ```ts
 * const response = await fetch('/api/users?page=1&limit=10')
 * const { data, pagination } = await parsePaginatedResponse<User>(response)
 * ```
 */
export async function parsePaginatedResponse<T>(
  response: Response,
): Promise<{ data: T[]; pagination: PaginationMeta }> {
  const contentType = response.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    throw new ApiError(
      `Expected JSON response, got ${contentType}`,
      response.status,
    );
  }

  let json: unknown;

  try {
    json = await response.json();
  } catch {
    throw new ApiError("Gagal memproses respon JSON", response.status);
  }

  if (!response.ok) {
    const errorData = json as Partial<ApiResponse<unknown>>;
    throw new ApiError(
      errorData.message || errorData.error || `HTTP Error: ${response.status}`,
      response.status,
      errorData.errors,
    );
  }

  const obj = json as Record<string, unknown>;

  // Extract data array
  const dataArray = unwrapData<T[]>(json);

  // Extract pagination metadata
  const pagination: PaginationMeta = {
    page: extractNumber(obj, ["page", "currentPage", "current_page"]) || 1,
    limit:
      extractNumber(obj, [
        "limit",
        "perPage",
        "per_page",
        "pageSize",
        "page_size",
      ]) || 10,
    total:
      extractNumber(obj, ["total", "totalCount", "total_count", "count"]) || 0,
    totalPages:
      extractNumber(obj, [
        "totalPages",
        "total_pages",
        "pages",
        "lastPage",
        "last_page",
      ]) || 1,
  };

  // Check for nested pagination object
  if (obj.pagination && typeof obj.pagination === "object") {
    const paginationObj = obj.pagination as Record<string, unknown>;
    pagination.page =
      extractNumber(paginationObj, ["page", "currentPage"]) || pagination.page;
    pagination.limit =
      extractNumber(paginationObj, ["limit", "perPage", "pageSize"]) ||
      pagination.limit;
    pagination.total =
      extractNumber(paginationObj, ["total", "totalCount"]) || pagination.total;
    pagination.totalPages =
      extractNumber(paginationObj, ["totalPages", "pages"]) ||
      pagination.totalPages;
  }

  // Check for meta object
  if (obj.meta && typeof obj.meta === "object") {
    const metaObj = obj.meta as Record<string, unknown>;
    pagination.page =
      extractNumber(metaObj, ["page", "currentPage"]) || pagination.page;
    pagination.limit =
      extractNumber(metaObj, ["limit", "perPage", "pageSize"]) ||
      pagination.limit;
    pagination.total =
      extractNumber(metaObj, ["total", "totalCount"]) || pagination.total;
    pagination.totalPages =
      extractNumber(metaObj, ["totalPages", "pages"]) || pagination.totalPages;
  }

  return { data: dataArray, pagination };
}

/**
 * Helper function to extract a number from an object using multiple possible keys
 */
function extractNumber(
  obj: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    if (key in obj && typeof obj[key] === "number") {
      return obj[key] as number;
    }
  }
  return undefined;
}

/**
 * Safe fetch wrapper with automatic response parsing
 *
 * @param url - Request URL
 * @param options - Fetch options
 * @returns Parsed response data
 *
 * @example
 * ```ts
 * const users = await safeFetch<User[]>('/api/users', { method: 'GET' })
 * ```
 */
export async function safeFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  return parseApiResponse<T>(response);
}

/**
 * Check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Get user-friendly error message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
}

/**
 * Menyusun pesan error yang bisa ditindaklanjuti dari body error API.
 *
 * `handleError` mengirim kegagalan validasi sebagai `{ error: "Validasi
 * gagal", details: { estimatedUnits: "...", area: "..." } }`. Klien selama ini
 * hanya membaca `message || error`, sehingga pengguna cuma melihat "Validasi
 * gagal" tanpa tahu field mana yang salah — sementara jawabannya sudah ada di
 * dalam respons. Fungsi ini menempelkan detail per-field ke pesan utama.
 *
 * @param body body JSON respons error, apa adanya
 * @param fallback pesan bila server tidak mengirim keterangan apa pun
 */
export function formatApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") {
    return fallback;
  }

  const payload = body as {
    message?: unknown;
    error?: unknown;
    details?: unknown;
  };

  const baseMessage =
    (typeof payload.message === "string" && payload.message) ||
    (typeof payload.error === "string" && payload.error) ||
    fallback;

  if (!payload.details || typeof payload.details !== "object") {
    return baseMessage;
  }

  const fieldMessages = Object.entries(
    payload.details as Record<string, unknown>,
  )
    .filter(([, message]) => typeof message === "string")
    .map(([field, message]) => `${field}: ${message as string}`);

  if (fieldMessages.length === 0) {
    return baseMessage;
  }

  return `${baseMessage} — ${fieldMessages.join("; ")}`;
}
