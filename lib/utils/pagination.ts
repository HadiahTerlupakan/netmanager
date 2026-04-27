export type PaginationParams = {
  page: number;
  limit: number;
};

export type PaginationMeta = PaginationParams & {
  total: number;
  totalPages: number;
};

const MIN_PAGE = 1;

function normalizePositiveInteger(
  value: string | null,
  fallback: number,
): number {
  const parsedValue = Number.parseInt(value ?? "", 10);

  if (Number.isNaN(parsedValue) || parsedValue < MIN_PAGE) {
    return fallback;
  }

  return parsedValue;
}

/**
 * Parse pagination params from URLSearchParams safely.
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults: PaginationParams,
): PaginationParams {
  return {
    page: normalizePositiveInteger(searchParams.get("page"), defaults.page),
    limit: normalizePositiveInteger(searchParams.get("limit"), defaults.limit),
  };
}

/**
 * Build pagination metadata without changing response shape.
 */
export function buildPaginationMeta(input: {
  page: number;
  limit: number;
  total: number;
}): PaginationMeta {
  const totalPages = input.total > 0 ? Math.ceil(input.total / input.limit) : 0;

  return {
    page: input.page,
    limit: input.limit,
    total: input.total,
    totalPages,
  };
}
