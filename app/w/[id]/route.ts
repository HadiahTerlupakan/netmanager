import { headers } from "next/headers";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * HTTPS bridge untuk deep link mobile.
 * WhatsApp hanya auto-link http(s), jadi WA mengirim
 * https://radpro.id/w/<woId> → handler ini return HTML
 * yang redirect ke netmanager://work-order-detail/<woId>.
 */
export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  if (!isValidWorkOrderId(id)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const deepLink = `netmanager://work-order-detail/${id}`;
  const fallbackUrl = await resolveAdminFallbackUrl(id);

  const html = buildBridgeHtml(deepLink, fallbackUrl);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function buildBridgeHtml(deepLink: string, fallbackUrl: string): string {
  const escapedDeepLink = escapeHtml(deepLink);
  const escapedFallback = escapeHtml(fallbackUrl);
  const safeJson = JSON.stringify(deepLink);

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="refresh" content="0;url=${escapedDeepLink}" />
<title>Membuka NetManager…</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;background:#0f172a;color:#e2e8f0;padding:24px;text-align:center}
  a{color:#38bdf8;text-decoration:underline}
  .muted{color:#94a3b8}
</style>
</head>
<body>
<div>
<p style="font-size:18px;font-weight:600;margin:0 0 8px">Membuka aplikasi NetManager…</p>
<p class="muted" style="font-size:14px;margin:0 0 24px">Jika app tidak terbuka otomatis, pastikan NetManager sudah terpasang di perangkat ini.</p>
<p style="font-size:13px">
  <a href="${escapedDeepLink}">Buka di Aplikasi</a>
  <span class="muted"> · </span>
  <a class="muted" href="${escapedFallback}">Buka di Web Admin</a>
</p>
</div>
<script>window.location.replace(${safeJson});</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isValidWorkOrderId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{8,64}$/.test(id);
}

async function resolveAdminFallbackUrl(workOrderId: string): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "radpro.id";
    const proto = h.get("x-forwarded-proto") || "https";
    return `${proto}://${host}/admin/workorders/${workOrderId}`;
  } catch {
    return `https://radpro.id/admin/workorders/${workOrderId}`;
  }
}
