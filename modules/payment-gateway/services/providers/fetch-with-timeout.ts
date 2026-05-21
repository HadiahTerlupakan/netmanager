const DEFAULT_TIMEOUT_MS = 30_000;

/** Wrapper fetch dengan AbortController timeout. */
export function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...fetchOptions, signal: controller.signal }).finally(
    () => clearTimeout(timeoutId),
  );
}
