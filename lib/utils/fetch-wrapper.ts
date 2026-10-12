/**
 * Standardized Fetch Wrapper
 * Handles error responses, rate limiting (429), and provides consistent error format
 */

/**
 * Galat HTTP dari `fetchWithHandling`.
 *
 * Turunan `Error`, bukan objek biasa, dan itu bukan soal gaya: puluhan
 * pemanggil menulis `err instanceof Error ? err.message : "Terjadi kesalahan"`.
 * Selama galat ini berupa objek literal, pemeriksaan itu selalu gagal dan
 * pesan sebenarnya dari server dibuang — layar hanya menampilkan "Terjadi
 * kesalahan", sementara API sudah menjelaskan persis apa yang salah. Ditemukan
 * di Stock Opname 2026-10-12: server menolak dengan "Total kondisi (baik +
 * rusak + expire) tidak boleh melebihi stok fisik", operator tidak pernah
 * melihat kalimat itu.
 *
 * Bentuknya tetap memenuhi `isFetchError`, jadi pemanggil yang sudah memakai
 * penjaga tipe itu tidak berubah perilakunya.
 */
export class FetchError extends Error {
  readonly status: number;
  readonly details?: Record<string, string[]>;
  /** Detik yang harus ditunggu sebelum mencoba lagi (khusus 429). */
  readonly retryAfter?: number;

  constructor(input: {
    status: number;
    message: string;
    details?: Record<string, string[]>;
    retryAfter?: number;
  }) {
    super(input.message);
    this.name = "FetchError";
    this.status = input.status;
    this.details = input.details;
    this.retryAfter = input.retryAfter;
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: Record<string, string[]>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: Record<string, number>;
}

/**
 * Enhanced fetch wrapper with standardized error handling
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws FetchError with structured error information
 */
export async function fetchWithHandling<T = unknown>(
  url: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    // Handle rate limiting (429)
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 60;

      throw new FetchError({
        status: 429,
        message: `Terlalu banyak permintaan. Coba lagi dalam ${retrySeconds} detik.`,
        retryAfter: retrySeconds,
      });
    }

    // Parse response body
    const data = await response.json();

    // Handle non-OK responses
    if (!response.ok) {
      throw new FetchError({
        status: response.status,
        message: data.error || data.message || `Error ${response.status}`,
        details: data.details,
      });
    }

    // Return successful response
    return {
      success: true,
      data: data.data ?? data,
      pagination: data.pagination || data.meta,
      summary: data.summary,
    };
  } catch (error) {
    // Re-throw FetchError as-is
    if (isFetchError(error)) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new FetchError({
        status: 0,
        message: "Gagal terhubung ke server. Periksa koneksi internet Anda.",
      });
    }

    // Handle AbortError (Request Cancelled)
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    // Handle other errors
    throw new FetchError({
      status: 500,
      message:
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan tidak diketahui",
    });
  }
}

/**
 * Type guard for FetchError
 */
export function isFetchError(error: unknown): error is FetchError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "message" in error
  );
}

/**
 * Format error message for display
 */
export function formatErrorMessage(error: FetchError): string {
  if (error.details) {
    const detailMessages = Object.entries(error.details)
      .map(
        ([field, messages]) =>
          `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`,
      )
      .join("; ");
    return `${error.message} (${detailMessages})`;
  }
  return error.message;
}

/**
 * Create a debounced version of fetchWithHandling
 */
export function createDebouncedFetch(delayMs: number = 300) {
  let timeoutId: NodeJS.Timeout | null = null;
  let abortController: AbortController | null = null;

  return async function debouncedFetch<T = unknown>(
    url: string,
    options?: RequestInit,
  ): Promise<ApiResponse<T>> {
    // Cancel previous request
    if (abortController) {
      abortController.abort();
    }

    // Clear previous timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Create new abort controller
    abortController = new AbortController();

    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await fetchWithHandling<T>(url, {
            ...options,
            signal: abortController!.signal,
          });
          resolve(result);
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            // Silently ignore aborted requests
            return;
          }
          reject(error);
        }
      }, delayMs);
    });
  };
}

/**
 * Ambil payload dari envelope respons API (`apiSuccess`), yang berbentuk
 * `{ success: true, data: {...} }`.
 *
 * Why: pemanggil yang memakai `fetch` mentah (bukan `fetchWithHandling`) mudah
 * lupa membuka `data` dan diam-diam membaca `undefined` — bug seperti ini bikin
 * bell notifikasi selalu tampak kosong padahal API mengembalikan datanya.
 * Respons yang sudah tidak berbungkus dikembalikan apa adanya.
 */
export function unwrapApiData<T>(body: unknown): T {
  if (body && typeof body === "object" && "data" in body) {
    const wrapped = (body as { data?: unknown }).data;
    if (wrapped && typeof wrapped === "object") {
      return wrapped as T;
    }
  }
  return body as T;
}
