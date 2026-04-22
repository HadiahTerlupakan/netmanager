const RUNTIME_SMOKE_TIMEOUT_MS = 1000;

export async function probeRuntimeHealth(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const response = await fetchImpl(`${baseUrl}/api/health`, {
    method: "GET",
    signal: AbortSignal.timeout(RUNTIME_SMOKE_TIMEOUT_MS),
  });

  return response.ok;
}
