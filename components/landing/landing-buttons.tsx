"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cx, EASE, RADPRO_MARK } from "./landing-content";

/** RADPRO brand mark — uses the mobile app icon when no custom logo is set. */
export function BrandMark({
  companyName,
  logoUrl,
  showWordmark = true,
}: {
  companyName: string;
  logoUrl?: string | null;
  showWordmark?: boolean;
}) {
  const src = logoUrl || RADPRO_MARK;
  const isCustom = Boolean(logoUrl);
  const isRadpro =
    !companyName ||
    companyName === "RADPRO.ID" ||
    companyName.toUpperCase().includes("RADPRO");

  return (
    <span
      className={`inline-flex items-center gap-2.5 font-semibold tracking-tight ${cx.ink}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={companyName || "RADPRO"}
        className={`h-8 w-8 object-contain ${isCustom ? "" : "rounded-[9px] shadow-sm ring-1 ring-black/5 dark:ring-white/10"}`}
        width={32}
        height={32}
      />
      {showWordmark &&
        (isRadpro ? (
          <span className="text-[15px] leading-none">
            RADPRO
            <span className="text-[#0a46aa] dark:text-[#5b8def]">.ID</span>
          </span>
        ) : (
          <span className="text-[15px] leading-none">{companyName}</span>
        ))}
    </span>
  );
}

/**
 * Tautan yang keluar dari aplikasi ini harus dirender sebagai `<a>`.
 *
 * `next/link` menangkap klik dan menjalankan navigasi klien ke path yang sama
 * pada origin yang sedang dibuka, sehingga host pada tautan lintas subdomain
 * ikut hilang: klik "Masuk" ke `https://admin.<domain>/login` berakhir di
 * `https://<domain>/admin/login` (terlihat sebagai permintaan `?_rsc=` ke apex).
 */
export function isExternalHref(href: string): boolean {
  return (
    href.startsWith("http") ||
    href.startsWith("mailto:") ||
    href.startsWith("#")
  );
}

/** Tautan landing yang memilih sendiri antara `<a>` dan `next/link`. */
export function LandingLink({
  href,
  children,
  className = "",
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  if (isExternalHref(href)) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

/** Primary CTA — accent pill with nested arrow chip. */
export function PrimaryCta({
  href,
  children,
  className = "",
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const classes = `group inline-flex items-center gap-2 rounded-full ${cx.accentBg} pl-5 pr-1.5 py-1.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(24,24,27,0.08),0_8px_24px_-8px_rgba(10,70,170,0.45)] transition-all ${EASE} active:scale-[0.98] ${className}`;
  const content = (
    <>
      <span>{children}</span>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
    </>
  );

  return (
    <LandingLink href={href} className={classes} onClick={onClick}>
      {content}
    </LandingLink>
  );
}

/** Secondary CTA — white surface with hairline ring. */
export function SecondaryCta({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const classes = `inline-flex items-center justify-center rounded-full ${cx.surface} px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 ring-1 ${cx.ring} shadow-[0_1px_2px_rgba(24,24,27,0.04)] transition-all ${EASE} hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.98] ${className}`;

  return (
    <LandingLink href={href} className={classes}>
      {children}
    </LandingLink>
  );
}
