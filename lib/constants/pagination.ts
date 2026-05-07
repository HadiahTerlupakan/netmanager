/**
 * Pagination Constants
 *
 * Centralized pagination defaults untuk menghindari magic numbers
 * di seluruh API routes.
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;
export const MIN_LIMIT = 1;

/**
 * Parse dan validate pagination parameters dari query string
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults?: { page?: number; limit?: number },
): { page: number; limit: number } {
  const page = Math.max(
    parseInt(
      searchParams.get("page") || String(defaults?.page ?? DEFAULT_PAGE),
    ),
    DEFAULT_PAGE,
  );

  const limit = Math.min(
    Math.max(
      parseInt(
        searchParams.get("limit") || String(defaults?.limit ?? DEFAULT_LIMIT),
      ),
      MIN_LIMIT,
    ),
    MAX_LIMIT,
  );

  return { page, limit };
}
