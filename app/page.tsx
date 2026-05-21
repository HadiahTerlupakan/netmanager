import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import SaasLandingPage from "@/components/landing/SaasLandingPage";
import TenantLandingPage from "@/components/landing/TenantLandingPage";
import type { Metadata } from "next";
import { getPublicPortalSettings } from "@/modules/settings";
import { DEFAULT_PUBLIC_APP_NAME } from "@/lib/settings/publicBranding";
import { MAIN_TENANT_ID } from "@/lib/tenant-constants";
import { prisma } from "@/modules/database";

export const metadata: Metadata = {
  title: "RADPRO.ID - Platform Manajemen ISP All-in-One",
  description:
    "Billing, network monitoring, customer portal untuk ISP dalam satu platform.",
};

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
      // Slug-based subdomain: e.g. myisp.radpro.id
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
      // Custom domain: e.g. portal.myisp.com
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

  // Main tenant or no tenant resolved → SaaS marketing page
  if (!tenantId || tenantId === MAIN_TENANT_ID) {
    return <SaasLandingPage />;
  }

  // Tenant resolved → tenant-branded landing page
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
