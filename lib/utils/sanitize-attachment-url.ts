/**
 * Sanitize a user-supplied attachment URL for safe rendering as `<a href>` /
 * `<Image src>`. Neutralises dangerous schemes (`javascript:`, `data:`,
 * `vbscript:`, `file:`, …) to `"#"`.
 *
 * Allowed: `http:`, `https:`, and same-origin relative paths starting with `/`.
 * The upload pipeline only ever returns those two shapes (R2 public URL or
 * local `/uploads/...`), so anything else is treated as hostile.
 */
export function sanitizeAttachmentUrl(url: string | null | undefined): string {
  if (!url) return "#";

  const trimmed = url.trim();
  if (!trimmed) return "#";

  // Relative path — same-origin, safe. Check before scheme parsing so a
  // leading `/` never falls through to the URL constructor.
  if (trimmed.startsWith("/")) return trimmed;

  // Allow only explicit http(s) schemes. Reject everything else including
  // protocol-relative `//host`, which `new URL("//x", base)` would silently
  // upgrade to the page's scheme and could be used for bypasses.
  const httpMatch = /^https?:\/\//i.exec(trimmed);
  if (!httpMatch) return "#";

  try {
    // Final guard: ensure the URL parses and the protocol is still http(s)
    // (catches malformed inputs that slip past the regex).
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return trimmed;
    }
    return "#";
  } catch {
    return "#";
  }
}
