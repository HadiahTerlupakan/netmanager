type ApiBody = { error?: string; message?: string; data?: unknown };

/** Request yang dijawab non-2xx; `status` adalah status HTTP-nya. */
export class RouterVpnRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "RouterVpnRequestError";
  }
}

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
  if (!res.ok) {
    throw new RouterVpnRequestError(
      json.error || json.message || "Gagal",
      res.status,
    );
  }
  return json;
}
