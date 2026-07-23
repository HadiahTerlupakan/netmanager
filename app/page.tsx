import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import SaasLandingPage from "@/components/landing/SaasLandingPage";
import TenantLandingPage from "@/components/landing/TenantLandingPage";
import type { Metadata } from "next";
import { getPublicPortalSettings } from "@/modules/settings";
import { DEFAULT_PUBLIC_APP_NAME } from "@/lib/settings/publicBranding";
import { MAIN_TENANT_ID } from "@/lib/tenant-constants";
import { prisma } from "@/modules/database";
import { LandingContentService } from "@/modules/website";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
  "https://radpro.id";

const SITE_NAME = "RADPRO.ID";
const SITE_TITLE =
  "RADPRO.ID — Platform Manajemen ISP All-in-One | Billing, MikroTik, Portal Pelanggan";
const SITE_DESCRIPTION =
  "Platform manajemen ISP all-in-one: billing & invoicing otomatis, integrasi MikroTik & OLT, portal pelanggan, monitoring real-time, dan manajemen karyawan. Mulai gratis.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    absolute: SITE_TITLE,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "software ISP",
    "billing ISP",
    "manajemen ISP",
    "MikroTik billing",
    "portal pelanggan ISP",
    "PPPoE management",
    "OLT management",
    "RADPRO",
    "RADPRO.ID",
    "software FTTH",
    "tagihan internet otomatis",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "technology",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/brand/radpro-icon.png",
        width: 512,
        height: 512,
        alt: "Logo RADPRO.ID",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/brand/radpro-icon.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/brand/radpro-icon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
};

/** JSON-LD for SoftwareApplication + Organization (SaaS landing only). */
function LandingJsonLd() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/brand/radpro-icon.png`,
        },
        email: "sales@radpro.id",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "id-ID",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "IDR",
          description: "Paket Starter gratis hingga 50 pelanggan",
        },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // JSON-LD must be raw JSON in script tag for crawlers
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const customerToken = cookieStore.get("customer-token");

  if (customerToken) {
    redirect("/dashboard");
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const normalizedHost = host?.split(":")[0]?.trim().toLowerCase();
  const baseDomain = process.env.DOMAIN || "radpro.id";

  let tenantId: string | null = null;
  let tenantSlug: string | null = null;

  if (
    normalizedHost &&
    normalizedHost !== baseDomain &&
    normalizedHost !== "localhost"
  ) {
    if (normalizedHost.endsWith(`.${baseDomain}`)) {
      const slug = normalizedHost.replace(`.${baseDomain}`, "");
      const td = await prisma.tenantDomain.findUnique({
        where: { slug },
        select: { tenantId: true, slug: true },
      });
      if (td) {
        tenantId = td.tenantId;
        tenantSlug = td.slug;
      }
    } else {
      const td = await prisma.tenantDomain.findFirst({
        where: { domain: normalizedHost, status: "active" },
        select: { tenantId: true, slug: true },
      });
      if (td) {
        tenantId = td.tenantId;
        tenantSlug = td.slug;
      }
    }
  }

  if (!tenantId || tenantId === MAIN_TENANT_ID) {
    let landingContent = null;
    try {
      const service = new LandingContentService();
      landingContent = await service.getAllContent();
    } catch {
      // fallback to null — component will use hardcoded defaults
    }
    return (
      <>
        <LandingJsonLd />
        <SaasLandingPage content={landingContent} />
      </>
    );
  }

  let brandingName = DEFAULT_PUBLIC_APP_NAME;
  let brandingLogoUrl: string | undefined;

  try {
    const branding = await getPublicPortalSettings();
    brandingName = branding.namaAplikasi || DEFAULT_PUBLIC_APP_NAME;
    brandingLogoUrl = branding.landingLogoUrl || undefined;
  } catch {
    // fallback to defaults
  }

  return (
    <TenantLandingPage
      brandingName={brandingName}
      brandingLogoUrl={brandingLogoUrl}
      tenantSlug={tenantSlug!}
    />
  );
}
