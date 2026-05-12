import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import LandingPage from "@/components/LandingPage";
import type { Metadata } from "next";
import { getPublicPortalSettings } from "@/modules/settings";
import { DEFAULT_PUBLIC_APP_NAME } from "@/lib/settings/publicBranding";

export const metadata: Metadata = {
  title: "RADPRO.ID - Provider Internet Fiber Optik Unlimited Tercepat",
  description:
    "Rasakan pengalaman internet ngebut tanpa ribet dengan RADPRO.ID. Provider fiber optik dengan koneksi stabil, unlimited tanpa FUP, dan dukungan 24/7 untuk rumah & bisnis.",
  keywords: [
    "internet wifi",
    "fiber optik",
    "provider internet jakarta",
    "wifi murah",
    "pasang wifi",
    "radpro",
    "internet stabil",
  ],
  openGraph: {
    title: "RADPRO.ID - Internet Fiber Optik Ngebut Tanpa Ribet",
    description:
      "Internet unlimited stabil untuk produktivitas digital Anda. Support 24/7, Anti Badai, Tanpa FUP.",
    url: "https://radpro.id",
    siteName: "RADPRO.ID",
    locale: "id_ID",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

function toAbsoluteUrl(
  path: string,
  origin: string | null,
): string | undefined {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (!origin) {
    return undefined;
  }

  return new URL(path, origin).toString();
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const customerToken = cookieStore.get("customer-token");

  if (customerToken) {
    redirect("/dashboard");
  }

  let brandingName = DEFAULT_PUBLIC_APP_NAME;
  let brandingLogoUrl: string | undefined;

  try {
    const branding = await getPublicPortalSettings();
    brandingName = branding.namaAplikasi || DEFAULT_PUBLIC_APP_NAME;
    brandingLogoUrl = branding.landingLogoUrl || undefined;
  } catch {
    // gunakan fallback publik default
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") || "https";
  const origin = host ? `${protocol}://${host}` : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "InternetServiceProvider",
    name: brandingName,
    image: toAbsoluteUrl(brandingLogoUrl, origin),
    description:
      "Penyedia layanan internet fiber optik unlimited dengan koneksi stabil dan support 24/7.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Jl. Prof. Dr. Soepomo No.73B, Menteng Dalam, Tebet",
      addressLocality: "Jakarta Selatan",
      addressRegion: "DKI Jakarta",
      postalCode: "12870",
      addressCountry: "ID",
    },
    telephone: "021-83705900",
    priceRange: "$$",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "00:00",
      closes: "23:59",
    },
    url: origin || undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage
        brandingName={brandingName}
        brandingLogoUrl={brandingLogoUrl}
      />
    </>
  );
}
