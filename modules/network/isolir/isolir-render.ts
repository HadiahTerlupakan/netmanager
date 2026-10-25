import { createHash } from "crypto";
import type { IsolirContent } from "./isolir-page.types";

/** Di lab router: 32 KiB lewat API masih utuh, 64 KiB memutus koneksi. */
export const ROUTER_PAGE_MAX_BYTES = 24 * 1024;

export type IsolirRenderResult = {
  html: string;
  hash: string;
  dropped: Array<"logo" | "message">;
};

const ELLIPSIS = "…";
const HASH_LENGTH = 16;
const TINT_WHITE_SHARE = 0.92;

// RouterOS mengganti $(...) di halaman web proxy, jadi setiap $ dari tenant
// ditulis sebagai entitas agar tidak pernah muncul mentah di file.
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\$/g, "&#36;");
}

function multiline(value: string): string {
  return esc(value).replace(/\r\n|\r|\n/g, "<br>");
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Campur warna utama dengan putih untuk latar halaman. */
function tint(hex: string): string {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.round(c * (1 - TINT_WHITE_SHARE) + 255 * TINT_WHITE_SHARE);
  };
  return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
}

const STYLE = (color: string) => `
*{box-sizing:border-box}
body{margin:0;padding:16px;background:${tint(color)};font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1f2937;line-height:1.5}
.card{max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px 20px;box-shadow:0 1px 4px rgba(0,0,0,.12)}
.logo{display:block;max-width:160px;max-height:80px;margin:0 auto 12px}
.isp{margin:0 0 4px;text-align:center;font-size:14px;color:#6b7280}
h1{margin:0 0 12px;text-align:center;font-size:20px;color:${color}}
p{margin:0 0 16px;overflow-wrap:anywhere}
h2{margin:20px 0 8px;font-size:15px;color:${color}}
.acc{border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:8px;overflow-wrap:anywhere}
.acc b{display:block}
.acc .no{font-size:18px;letter-spacing:.5px}
.btn{display:block;margin-top:12px;padding:12px;border-radius:8px;background:${color};color:#fff;text-align:center;text-decoration:none;font-weight:600}
.contact{margin-top:16px;font-size:14px;color:#4b5563;text-align:center;overflow-wrap:anywhere}`;

function paymentsHtml(content: IsolirContent): string {
  if (content.payments.length === 0) return "";
  const items = content.payments
    .map(
      (p) =>
        `<div class="acc"><b>${esc(p.label)}</b><span class="no">${esc(p.number)}</span><br>a.n. ${esc(p.holder)}</div>`,
    )
    .join("");
  return `<h2>Rekening Pembayaran</h2>${items}`;
}

function actionsHtml(content: IsolirContent): string {
  const parts: string[] = [];
  if (content.whatsapp) {
    const href = `https://wa.me/${esc(content.whatsapp.number)}?text=${esc(encodeURIComponent(content.whatsapp.text))}`;
    parts.push(`<a class="btn" href="${href}">Hubungi via WhatsApp</a>`);
  }
  if (content.link && isHttpUrl(content.link.url)) {
    parts.push(
      `<a class="btn" href="${esc(content.link.url)}">${esc(content.link.label)}</a>`,
    );
  }
  return parts.join("");
}

function build(content: IsolirContent, message: string, logo: boolean): string {
  const logoTag =
    logo && content.logoDataUri
      ? `<img class="logo" alt="" src="${esc(content.logoDataUri)}">`
      : "";
  const contact = content.contactText
    ? `<div class="contact">${multiline(content.contactText)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(content.title)}</title>
<style>${STYLE(content.primaryColor)}</style></head>
<body><div class="card">${logoTag}<div class="isp">${esc(content.ispName)}</div>
<h1>${esc(content.title)}</h1>
<p>${multiline(message)}</p>${paymentsHtml(content)}${actionsHtml(content)}${contact}
</div></body></html>
`;
}

const fits = (html: string) => Buffer.byteLength(html) <= ROUTER_PAGE_MAX_BYTES;

/** Potong pesan sepanjang mungkin agar halaman muat; kosong bila tak ada yang muat. */
function fitMessage(content: IsolirContent, logo: boolean): string {
  const chars = Array.from(content.message);
  const attempt = (n: number) => chars.slice(0, n).join("") + ELLIPSIS;
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(build(content, attempt(mid), logo))) lo = mid;
    else hi = mid - 1;
  }
  const best = attempt(lo);
  return fits(build(content, best, logo)) ? best : "";
}

/** Render halaman isolir statis untuk router, dijaga di bawah batas ukuran. */
export function renderIsolirPage(content: IsolirContent): IsolirRenderResult {
  const dropped: IsolirRenderResult["dropped"] = [];
  let html = build(content, content.message, true);
  let logo = true;

  if (!fits(html) && content.logoDataUri) {
    logo = false;
    dropped.push("logo");
    html = build(content, content.message, false);
  }
  if (!fits(html)) {
    dropped.push("message");
    html = build(content, fitMessage(content, logo), logo);
  }

  const hash = createHash("sha256").update(html).digest("hex");
  return { html, hash: hash.slice(0, HASH_LENGTH), dropped };
}
