/**
 * Header `Content-Disposition` yang aman untuk nama berkas apa pun.
 *
 * Nilai header HTTP hanya boleh berisi byte Latin-1; nama berkas unggahan
 * pengguna (mis. "Surat—Final.pdf", aksara non-Latin) membuat `new Response`
 * melempar galat. Karena itu dikirim dua bentuk: `filename` ASCII sebagai
 * cadangan dan `filename*` (RFC 5987) berisi nama aslinya.
 */
export function buildContentDisposition(
  fileName: string,
  disposition: "inline" | "attachment" = "inline",
): string {
  const asciiFallback = fileName
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
