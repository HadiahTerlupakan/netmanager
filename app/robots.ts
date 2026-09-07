import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
  "https://radpro.id";

/** Crawl rules: index marketing surfaces, block app/admin/api. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/kebijakan-privasi", "/kebijakan-privasi-aplikasi"],
        disallow: [
          "/admin/",
          "/api/",
          "/karyawan/",
          "/dashboard",
          "/w/",
          "/p/",
          "/register/",
          "/registrasi/",
          "/mitra-id/",
          "/investor/",
          "/status/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
