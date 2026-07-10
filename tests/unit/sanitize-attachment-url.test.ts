import { describe, expect, it } from "vitest";

import { sanitizeAttachmentUrl } from "@/lib/utils/sanitize-attachment-url";

// XSS defense: attachment URLs are rendered as `<a href>` and `<Image src>`
// (see MessagesList.tsx / ReplyComposer.tsx). Anything except http(s) MUST be
// neutralised to `#` so `javascript:` / `data:` / `vbscript:` payloads cannot
// execute when a user clicks the rendered link.
describe("sanitizeAttachmentUrl", () => {
  it("passes through https URLs unchanged", () => {
    expect(sanitizeAttachmentUrl("https://cdn.example.com/img.webp")).toBe(
      "https://cdn.example.com/img.webp",
    );
  });

  it("passes through http URLs unchanged", () => {
    expect(sanitizeAttachmentUrl("http://cdn.example.com/img.webp")).toBe(
      "http://cdn.example.com/img.webp",
    );
  });

  it("passes through relative paths (leading /) unchanged", () => {
    // Local storage uploads return "/uploads/tickets/xxx.webp" — must not
    // be neutralised, they are same-origin resources served by /public.
    expect(sanitizeAttachmentUrl("/uploads/tickets/abc.webp")).toBe(
      "/uploads/tickets/abc.webp",
    );
  });

  it("neutralises javascript: URLs to '#'", () => {
    expect(sanitizeAttachmentUrl("javascript:alert(1)")).toBe("#");
  });

  it("neutralises JavaScript: (mixed-case, with tab) to '#'", () => {
    // Attackers routinely bypass naive filters with whitespace / case tricks.
    expect(sanitizeAttachmentUrl("JavaScript\t:alert(1)")).toBe("#");
    expect(sanitizeAttachmentUrl("  JAVASCRIPT:alert(1)")).toBe("#");
  });

  it("neutralises data: URLs to '#'", () => {
    expect(
      sanitizeAttachmentUrl("data:text/html,<script>alert(1)</script>"),
    ).toBe("#");
  });

  it("neutralises vbscript: URLs to '#'", () => {
    expect(sanitizeAttachmentUrl("vbscript:msgbox(1)")).toBe("#");
  });

  it("neutralises file: URLs to '#'", () => {
    // file:// can exfiltrate local resources in some contexts.
    expect(sanitizeAttachmentUrl("file:///etc/passwd")).toBe("#");
  });

  it("returns '#' for empty string / whitespace-only", () => {
    expect(sanitizeAttachmentUrl("")).toBe("#");
    expect(sanitizeAttachmentUrl("   ")).toBe("#");
  });

  it("returns '#' for null / undefined", () => {
    expect(sanitizeAttachmentUrl(null)).toBe("#");
    expect(sanitizeAttachmentUrl(undefined)).toBe("#");
  });

  it("returns '#' for garbage input", () => {
    expect(sanitizeAttachmentUrl("not a url at all")).toBe("#");
  });
});
