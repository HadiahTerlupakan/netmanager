type ApiBody = { error?: string; message?: string; data?: unknown };

/** Mengirim request JSON dan mengembalikan body-nya; melempar bila gagal. */
export async function sendRequest(
  url: string,
  method: string,
  body?: unknown,
): Promise<ApiBody> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as ApiBody;
  if (!res.ok) throw new Error(json.error || json.message || "Gagal");
  return json;
}
