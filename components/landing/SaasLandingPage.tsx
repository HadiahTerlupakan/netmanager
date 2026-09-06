"use client";

import { useState } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  Clock3,
  Menu,
  MonitorDot,
  Receipt,
  Router,
  Users,
  X,
} from "lucide-react";
import type { LandingContentAll } from "@/modules/website";
import {
  cx,
  EASE,
  NAV_LINKS,
  DEFAULT_FAQ,
  DEFAULT_FEATURES,
  DEFAULT_FOOTER,
  DEFAULT_HERO,
  DEFAULT_PRICING,
  type LandingFaqLike,
  type LandingFeatureLike,
  type LandingFooterLike,
  type LandingPricingLike,
} from "./landing-content";
import {
  BrandMark,
  LandingLink,
  PrimaryCta,
  SecondaryCta,
} from "./landing-buttons";
import { ThemeSwitch } from "./landing-theme-switch";
import { ProductMock } from "./landing-product-mock";
import { SectionEyebrow, SectionTitle } from "./landing-section";
import {
  getAdminPortalUrl,
  resolveAdminPortalHref,
} from "@/lib/utils/portal-url";

const ADMIN_LOGIN_URL = getAdminPortalUrl();

const ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  MdReceiptLong: Receipt,
  MdRouter: Router,
  MdPeople: Users,
  MdAccessTime: Clock3,
  MdMonitor: MonitorDot,
  MdBusiness: Building2,
  Receipt,
  Router,
  Users,
  Clock3,
  MonitorDot,
  Building2,
};

interface SaasLandingPageProps {
  content: LandingContentAll | null;
}

/** SaaS marketing landing page for the main RADPRO.ID domain. */
export default function SaasLandingPage({ content }: SaasLandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const hero = content?.hero ?? DEFAULT_HERO;
  const features: LandingFeatureLike[] =
    content?.features && content.features.length > 0
      ? content.features
      : DEFAULT_FEATURES;
  const pricing: LandingPricingLike[] =
    content?.pricing && content.pricing.length > 0
      ? content.pricing
      : DEFAULT_PRICING;
  const faq: LandingFaqLike[] =
    content?.faq && content.faq.length > 0 ? content.faq : DEFAULT_FAQ;
  const footer: LandingFooterLike = content?.footer ?? DEFAULT_FOOTER;

  const featureList = features.slice(0, 6);
  const pricingCount = pricing.length;
  const pricingGrid =
    pricingCount === 1
      ? "mx-auto max-w-sm grid-cols-1"
      : pricingCount === 2
        ? "mx-auto max-w-2xl grid-cols-1 md:grid-cols-2"
        : "grid-cols-1 md:grid-cols-3";

  return (
    <div
      className={`landing-saas min-h-[100dvh] ${cx.page} antialiased selection:bg-[#0a46aa]/15 selection:text-inherit`}
    >
      {/* ── Island Nav ── */}
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <nav
          className={`mx-auto flex max-w-5xl items-center justify-between gap-2 rounded-full ${cx.surfaceGlass} px-2 py-1.5 pl-4 shadow-[0_1px_2px_rgba(24,24,27,0.04),0_8px_24px_-12px_rgba(24,24,27,0.1)] dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] ring-1 ${cx.ring} backdrop-blur-xl`}
        >
          <BrandMark companyName={footer.companyName} logoUrl={hero.logoUrl} />

          <div className="hidden items-center gap-0.5 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={resolveAdminPortalHref(link.href)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${cx.muted} transition-colors ${EASE} hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50`}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeSwitch />
            <LandingLink
              href={ADMIN_LOGIN_URL}
              className={`hidden rounded-full px-3.5 py-2 text-[13px] font-medium text-zinc-600 dark:text-zinc-300 transition-colors ${EASE} hover:text-zinc-900 dark:hover:text-white md:inline`}
            >
              Masuk
            </LandingLink>
            <span className="hidden md:inline-flex">
              <PrimaryCta href={ADMIN_LOGIN_URL}>Mulai sekarang</PrimaryCta>
            </span>
            <button
              type="button"
              className={`flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden`}
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? "Tutup menu" : "Buka menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" strokeWidth={1.75} />
              ) : (
                <Menu className="h-5 w-5" strokeWidth={1.75} />
              )}
            </button>
          </div>
        </nav>

        {mobileMenuOpen && (
          <div
            className={`mx-auto mt-2 max-w-5xl overflow-hidden rounded-[1.5rem] ${cx.surfaceSheet} p-3 shadow-lg ring-1 ${cx.ring} backdrop-blur-xl md:hidden`}
          >
            <div className="flex flex-col gap-0.5">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={resolveAdminPortalHref(link.href)}
                  className={`rounded-xl px-3 py-3 text-sm font-medium ${cx.ink} transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div
              className={`mt-2 flex flex-col gap-2 border-t ${cx.line} pt-3`}
            >
              <LandingLink
                href={ADMIN_LOGIN_URL}
                className={`rounded-full px-4 py-2.5 text-center text-sm font-medium ${cx.ink} ring-1 ${cx.ring}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Masuk
              </LandingLink>
              <PrimaryCta
                href={ADMIN_LOGIN_URL}
                className="w-full justify-between"
                onClick={() => setMobileMenuOpen(false)}
              >
                Mulai sekarang
              </PrimaryCta>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 h-[400px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(10,70,170,0.12),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(91,141,239,0.14),transparent_65%)]" />
            <div
              className="absolute inset-0 opacity-[0.4] dark:opacity-[0.25]"
              style={{
                backgroundImage:
                  "radial-gradient(currentColor 1px, transparent 1px)",
                backgroundSize: "24px 24px",
                color: "rgb(24 24 27 / 0.08)",
                maskImage:
                  "radial-gradient(ellipse at center, black 20%, transparent 70%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse at center, black 20%, transparent 70%)",
              }}
            />
          </div>

          <div className="mx-auto max-w-3xl text-center">
            {hero.badge && (
              <div
                className={`mb-6 inline-flex items-center gap-2 rounded-full ${cx.surface} px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] ${cx.muted} ring-1 ${cx.ring} shadow-[0_1px_2px_rgba(24,24,27,0.04)]`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#0a46aa] dark:bg-[#5b8def]" />
                {hero.badge}
              </div>
            )}

            <h1
              className={`text-balance text-5xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-7xl ${cx.ink}`}
            >
              {hero.title}{" "}
              {hero.highlight && (
                <span className={cx.accent}>{hero.highlight}</span>
              )}
            </h1>

            <p
              className={`mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed sm:text-lg ${cx.muted}`}
            >
              {hero.subtitle}
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCta href={resolveAdminPortalHref(hero.ctaLink)}>
                {hero.ctaPrimary}
              </PrimaryCta>
              <SecondaryCta href="#features">{hero.ctaSecondary}</SecondaryCta>
            </div>

            <div
              className={`mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm ${cx.muted}`}
            >
              <div className="inline-flex items-center gap-1.5">
                <Check
                  className="h-3.5 w-3.5 text-emerald-500"
                  strokeWidth={2.5}
                />
                Tanpa kartu kredit
              </div>
              <span className="hidden h-3 w-px bg-zinc-200 dark:bg-white/10 sm:block" />
              <div className="inline-flex items-center gap-1.5">
                <Check
                  className="h-3.5 w-3.5 text-emerald-500"
                  strokeWidth={2.5}
                />
                Setup dalam 5 menit
              </div>
            </div>
          </div>

          <div className="mx-auto mt-14 max-w-5xl sm:mt-16">
            <ProductMock />
          </div>
        </section>

        {/* ── Features ── */}
        <section
          id="features"
          className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
        >
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <SectionEyebrow>Fitur</SectionEyebrow>
              <SectionTitle>
                Semua yang dibutuhkan untuk menjalankan ISP
              </SectionTitle>
              <p
                className={`mt-4 text-base leading-relaxed sm:text-lg ${cx.muted}`}
              >
                Dari billing hingga monitoring jaringan — satu platform, satu
                sumber kebenaran operasional.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featureList.map((feature) => {
                const IconComponent = ICON_MAP[feature.icon] || Building2;
                return (
                  <article
                    key={feature.title}
                    className={`group rounded-[1.5rem] bg-zinc-900/[0.03] dark:bg-white/[0.03] p-1 ring-1 ring-zinc-900/[0.05] dark:ring-white/10 transition-shadow ${EASE} hover:shadow-[0_16px_32px_-20px_rgba(24,24,27,0.25)] dark:hover:shadow-[0_16px_32px_-16px_rgba(0,0,0,0.6)]`}
                  >
                    <div
                      className={`h-full rounded-[1.2rem] ${cx.surface} p-6 ring-1 ${cx.ring}`}
                    >
                      <div
                        className={`mb-5 flex h-10 w-10 items-center justify-center rounded-xl ${cx.accentSoft} ring-1`}
                      >
                        <IconComponent className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <h3
                        className={`text-[16px] font-semibold tracking-tight ${cx.ink}`}
                      >
                        {feature.title}
                      </h3>
                      <p className={`mt-2 text-sm leading-relaxed ${cx.muted}`}>
                        {feature.description}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section
          id="pricing"
          className={`scroll-mt-24 border-y ${cx.line} ${cx.surface} px-4 py-20 sm:px-6 sm:py-28 lg:px-8`}
        >
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>Harga</SectionEyebrow>
              <SectionTitle>Pilih paket yang sesuai</SectionTitle>
              <p className={`mt-4 text-base sm:text-lg ${cx.muted}`}>
                Transparan. Tanpa biaya tersembunyi. Batalkan kapan saja.
              </p>
            </div>

            <div className={`mt-12 grid items-stretch gap-4 ${pricingGrid}`}>
              {pricing.map((plan) => {
                const planCtaHref = resolveAdminPortalHref(plan.ctaLink);

                if (plan.isPopular) {
                  return (
                    <div
                      key={plan.name}
                      className={`relative flex flex-col rounded-[1.5rem] ${cx.deep} p-1 shadow-[0_20px_40px_-20px_rgba(12,12,14,0.4)]`}
                    >
                      <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
                        <span className="inline-flex rounded-full bg-[#0a46aa] px-3 py-1 text-[11px] font-medium tracking-wide text-white dark:bg-[#1a5bc4]">
                          Paling populer
                        </span>
                      </div>
                      <div className="flex h-full flex-col rounded-[1.2rem] p-7">
                        <p className="text-[13px] font-medium text-zinc-400">
                          {plan.name}
                        </p>
                        <div className="mt-3 flex items-baseline gap-1.5">
                          <span className="text-4xl font-semibold tracking-tight text-white">
                            {plan.price}
                          </span>
                        </div>
                        <p className="mt-1 min-h-[1.25rem] text-sm text-zinc-500">
                          {plan.period}
                        </p>
                        <ul className="mt-8 flex-1 space-y-3">
                          {plan.features.map((item) => (
                            <li
                              key={item}
                              className="flex items-start gap-2.5 text-sm text-zinc-300"
                            >
                              <Check
                                className="mt-0.5 h-4 w-4 shrink-0 text-[#5b8def]"
                                strokeWidth={2.25}
                              />
                              {item}
                            </li>
                          ))}
                        </ul>
                        <LandingLink
                          href={planCtaHref}
                          className={`mt-8 inline-flex w-full items-center justify-center rounded-full bg-white py-2.5 text-sm font-medium text-zinc-900 transition-all ${EASE} hover:bg-zinc-100 active:scale-[0.98]`}
                        >
                          {plan.ctaText}
                        </LandingLink>
                      </div>
                    </div>
                  );
                }

                const ctaClass = `mt-8 inline-flex w-full items-center justify-center rounded-full py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 ring-1 ${cx.ring} transition-all ${EASE} hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.98]`;

                return (
                  <div
                    key={plan.name}
                    className="flex flex-col rounded-[1.5rem] bg-zinc-900/[0.03] dark:bg-white/[0.03] p-1 ring-1 ring-zinc-900/[0.05] dark:ring-white/10"
                  >
                    <div
                      className={`flex h-full flex-col rounded-[1.2rem] ${cx.surface} p-7 ring-1 ${cx.ring}`}
                    >
                      <p className={`text-[13px] font-medium ${cx.muted}`}>
                        {plan.name}
                      </p>
                      <div className="mt-3 flex items-baseline gap-1.5">
                        <span
                          className={`text-4xl font-semibold tracking-tight ${cx.ink}`}
                        >
                          {plan.price}
                        </span>
                      </div>
                      <p className={`mt-1 min-h-[1.25rem] text-sm ${cx.faint}`}>
                        {plan.period}
                      </p>
                      <ul className="mt-8 flex-1 space-y-3">
                        {plan.features.map((item) => (
                          <li
                            key={item}
                            className={`flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-300`}
                          >
                            <Check
                              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                              strokeWidth={2.25}
                            />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <LandingLink href={planCtaHref} className={ctaClass}>
                        {plan.ctaText}
                      </LandingLink>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section
          id="faq"
          className={`scroll-mt-24 border-t ${cx.line} ${cx.surface} px-4 py-20 sm:px-6 sm:py-28 lg:px-8`}
        >
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionEyebrow>FAQ</SectionEyebrow>
              <SectionTitle>Pertanyaan umum</SectionTitle>
              <p className={`mt-4 text-sm leading-relaxed ${cx.muted}`}>
                Tidak menemukan jawaban? Hubungi{" "}
                <a
                  href={`mailto:${footer.email || "sales@radpro.id"}`}
                  className={`font-medium ${cx.accent} underline-offset-4 hover:underline`}
                >
                  {footer.email || "sales@radpro.id"}
                </a>
                .
              </p>
            </div>

            <div
              className={`divide-y divide-zinc-200/80 dark:divide-white/10 lg:col-span-8`}
            >
              {faq.map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={idx} className="py-1">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 py-5 text-left"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                    >
                      <span className={`text-[15px] font-medium ${cx.ink}`}>
                        {item.question}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                          isOpen ? "rotate-180" : ""
                        }`}
                        strokeWidth={1.75}
                      />
                    </button>
                    <div
                      className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p
                          className={`pb-5 pr-8 text-sm leading-relaxed ${cx.muted}`}
                        >
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div
              className={`relative overflow-hidden rounded-[1.75rem] ${cx.deep} px-6 py-14 text-center sm:px-12 sm:py-16`}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(10,70,170,0.35),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(91,141,239,0.22),transparent_55%)]" />
              <div className="relative">
                <h2 className="mx-auto max-w-xl text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
                  Siap modernisasi operasi ISP Anda?
                </h2>
                <p className="mx-auto mt-4 max-w-md text-base text-zinc-400">
                  Mulai kelola billing, jaringan, dan pelanggan dari satu
                  tempat. Daftar sekarang dan pilih paket yang sesuai.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <PrimaryCta href={ADMIN_LOGIN_URL}>Mulai sekarang</PrimaryCta>
                  <a
                    href="mailto:sales@radpro.id"
                    className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-zinc-300 ring-1 ring-white/15 transition-all ${EASE} hover:bg-white/5 hover:text-white active:scale-[0.98]`}
                  >
                    Hubungi sales
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer
        className={`border-t ${cx.line} ${cx.surface} px-4 py-12 sm:px-6 lg:px-8`}
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-10 md:flex-row md:gap-16">
            <div className="max-w-xs">
              <BrandMark
                companyName={footer.companyName}
                logoUrl={footer.logoUrl}
              />
              {footer.description && (
                <p className={`mt-4 text-sm leading-relaxed ${cx.muted}`}>
                  {footer.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-12">
              {Object.entries(footer.links).map(([groupLabel, items]) => (
                <div key={groupLabel}>
                  <p
                    className={`text-[12px] font-medium uppercase tracking-[0.12em] ${cx.faint}`}
                  >
                    {groupLabel}
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {items.map((link) => (
                      <li key={`${groupLabel}-${link.href}-${link.label}`}>
                        <a
                          href={resolveAdminPortalHref(link.href)}
                          className={`text-sm text-zinc-600 dark:text-zinc-300 transition-colors ${EASE} hover:text-zinc-900 dark:hover:text-white`}
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`mt-10 flex flex-col items-start justify-between gap-3 border-t ${cx.line} pt-6 text-xs ${cx.faint} sm:flex-row sm:items-center`}
          >
            <p>
              © {new Date().getFullYear()} {footer.companyName}. All rights
              reserved.
            </p>
            <p>
              <a
                href="/kebijakan-privasi"
                className={`transition-colors ${EASE} hover:text-zinc-700 dark:hover:text-zinc-200`}
              >
                Kebijakan Privasi
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
