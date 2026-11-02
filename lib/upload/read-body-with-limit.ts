/**
 * Baca body permintaan sambil menghitung byte, berhenti begitu melewati
 * `maxBytes`. `request.formData()` membaca seluruh body ke memori lebih dulu;
 * pengecekan `Content-Length` saja bisa dilewati dengan body chunked yang tidak
 * menyebut ukurannya. Mengembalikan null bila body melebihi batas.
 */
export async function readBodyWithLimit(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/**
 * Parse multipart dari body yang sudah dibatasi ukurannya. Hanya
 * `content-type` (pembawa boundary) yang disalin; header transport seperti
 * `transfer-encoding` milik body asli, bukan body yang sudah dibaca ini.
 */
export async function readFormDataWithLimit(
  request: Request,
  maxBytes: number,
): Promise<FormData | "terlalu-besar" | null> {
  const body = await readBodyWithLimit(request, maxBytes);
  if (body === null) return "terlalu-besar";
  try {
    return await new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type") ?? "" },
      body,
    }).formData();
  } catch {
    return null;
  }
}
