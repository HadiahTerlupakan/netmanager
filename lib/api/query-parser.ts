/**
 * Query Parser Utilities
 * Standardized parsing and sanitization for URL query parameters
 */

/**
 * Sanitize a query parameter value
 * Converts "", "null", "undefined" to undefined
 */
export function sanitizeQueryValue(value: string | null): string | undefined {
  if (
    value === null ||
    value === "" ||
    value === "null" ||
    value === "undefined"
  ) {
    return undefined;
  }
  return value;
}

/**
 * Parse URLSearchParams to a plain object with sanitization
 */
export function parseQuery(
  searchParams: URLSearchParams,
): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of searchParams.entries()) {
    const sanitized = sanitizeQueryValue(value);
    if (sanitized === undefined) continue;

    if (query[key]) {
      if (Array.isArray(query[key])) {
        (query[key] as string[]).push(sanitized);
      } else {
        query[key] = [query[key] as string, sanitized];
      }
    } else {
      query[key] = sanitized;
    }
  }

  return query;
}
