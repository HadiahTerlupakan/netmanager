import { headers } from "next/headers";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * HTTPS bridge untuk deep link mobile.
 * WhatsApp hanya auto-link http(s), jadi WA mengirim
 * https://radpro.id/w/<woId> → halaman ini redirect ke
 * netmanager://work-order-detail/<woId> yang membuka app.
 */
export default async function WorkOrderDeepLinkBridgePage({
  params,
}: PageProps) {
  const { id } = await params;
  if (!isValidWorkOrderId(id)) {
    notFound();
  }

  const deepLink = `netmanager://work-order-detail/${id}`;
  const fallbackUrl = await resolveAdminFallbackUrl(id);

  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="refresh" content={`0;url=${deepLink}`} />
        <title>Membuka NetManager…</title>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.location.replace(${JSON.stringify(deepLink)});`,
          }}
        />
      </head>
      <body
        style={{
          fontFamily:
            "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif",
          display: "flex",
          minHeight: "100vh",
          margin: 0,
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#e2e8f0",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div>
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Membuka aplikasi NetManager…
          </p>
          <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24 }}>
            Jika app tidak terbuka otomatis, pastikan NetManager sudah terpasang
            di perangkat ini.
          </p>
          <p style={{ fontSize: 13 }}>
            <a
              href={deepLink}
              style={{ color: "#38bdf8", textDecoration: "underline" }}
            >
              Buka di Aplikasi
            </a>
            {" · "}
            <a
              href={fallbackUrl}
              style={{ color: "#94a3b8", textDecoration: "underline" }}
            >
              Buka di Web Admin
            </a>
          </p>
        </div>
      </body>
    </html>
  );
}

function isValidWorkOrderId(id: string): boolean {
  // UUID v4/v7 atau cuid-like id yang dipakai Prisma
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
