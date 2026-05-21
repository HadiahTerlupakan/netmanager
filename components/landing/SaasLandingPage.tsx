"use client";

import Link from "next/link";
import { useState } from "react";
import {
  MdMenu,
  MdClose,
  MdArrowForward,
  MdCheck,
  MdReceiptLong,
  MdRouter,
  MdPeople,
  MdAccessTime,
  MdMonitor,
  MdBusiness,
  MdStar,
  MdExpandMore,
  MdRocketLaunch,
} from "react-icons/md";
import type {
  LandingContentAll,
  LandingFeature,
  LandingPricing,
  LandingTestimonial,
  LandingFaq,
  LandingFooter,
} from "@/modules/website";

// ── Icon mapping for DB-stored icon names ──────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MdReceiptLong,
  MdRouter,
  MdPeople,
  MdAccessTime,
  MdMonitor,
  MdBusiness,
};

// ── Types for default content that extends domain types ───────────────────

interface DefaultFeature {
  icon: string;
  color: string;
  title: string;
  description: string;
}

interface DefaultPricing {
  name: string;
  price: string;
  period: string;
  features: string[];
  isPopular: boolean;
  ctaText: string;
  ctaLink: string;
}

interface DefaultTestimonial {
  name: string;
  role: string;
  content: string;
  rating: number;
}

interface DefaultFaqItem {
  question: string;
  answer: string;
}

interface DefaultFooter {
  companyName: string;
  description: string;
  email: string;
  links: Record<string, Array<{ label: string; href: string }>>;
}

// ── Default content (mirrors current hardcoded values) ─────────────────────

const DEFAULT_HERO = {
  badge: "Platform ISP All-in-One",
  title: "Kelola ISP Anda",
  highlight: "Lebih Cerdas",
  subtitle:
    "Billing otomatis, manajemen jaringan MikroTik & OLT, portal pelanggan, dan manajemen karyawan — semua terintegrasi untuk ISP modern.",
  ctaPrimary: "Mulai Gratis 14 Hari",
  ctaSecondary: "Lihat Fitur",
  ctaLink: "/admin/login",
};

const DEFAULT_FEATURES: DefaultFeature[] = [
  {
    icon: "MdReceiptLong",
    color: "bg-indigo-50 text-indigo-600",
    title: "Billing & Invoicing Otomatis",
    description:
      "Generate tagihan bulanan secara otomatis, kirim notifikasi jatuh tempo, dan terima pembayaran via berbagai metode.",
  },
  {
    icon: "MdRouter",
    color: "bg-blue-50 text-blue-600",
    title: "Manajemen Jaringan",
    description:
      "Integrasi langsung dengan MikroTik RouterOS dan OLT. Kelola PPPoE, bandwidth, dan konfigurasi perangkat dari satu dashboard.",
  },
  {
    icon: "MdPeople",
    color: "bg-violet-50 text-violet-600",
    title: "Portal Pelanggan",
    description:
      "Pelanggan dapat cek tagihan, bayar, buat tiket gangguan, dan pantau status layanan mandiri tanpa menghubungi CS.",
  },
  {
    icon: "MdAccessTime",
    color: "bg-emerald-50 text-emerald-600",
    title: "Manajemen Karyawan",
    description:
      "Absensi, shift, lembur, dan penggajian karyawan terintegrasi. Kelola tim teknisi lapangan dengan mudah.",
  },
  {
    icon: "MdMonitor",
    color: "bg-amber-50 text-amber-600",
    title: "Monitoring Real-time",
    description:
      "Pantau status perangkat, trafik jaringan, dan uptime layanan secara real-time dengan alert otomatis.",
  },
  {
    icon: "MdBusiness",
    color: "bg-rose-50 text-rose-600",
    title: "Multi-tenant",
    description:
      "Satu platform untuk banyak ISP. Setiap tenant punya domain, branding, dan data yang terisolasi penuh.",
  },
];

// Feature card color cycle for DB-sourced features (no color stored in DB)
const FEATURE_COLORS = [
  "bg-indigo-50 text-indigo-600",
  "bg-blue-50 text-blue-600",
  "bg-violet-50 text-violet-600",
  "bg-emerald-50 text-emerald-600",
  "bg-amber-50 text-amber-600",
  "bg-rose-50 text-rose-600",
];

const DEFAULT_PRICING: DefaultPricing[] = [
  {
    name: "Starter",
    price: "Gratis",
    period: "Hingga 50 pelanggan",
    features: [
      "Billing otomatis",
      "Portal pelanggan",
      "1 admin user",
      "Support email",
    ],
    isPopular: false,
    ctaText: "Mulai Gratis",
    ctaLink: "/admin/login",
  },
  {
    name: "Pro",
    price: "Rp 499K",
    period: "per bulan · hingga 500 pelanggan",
    features: [
      "Semua fitur Starter",
      "Integrasi MikroTik & OLT",
      "Manajemen karyawan",
      "Monitoring real-time",
      "5 admin user",
      "Support prioritas",
    ],
    isPopular: true,
    ctaText: "Coba 14 Hari Gratis",
    ctaLink: "/admin/login",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "Pelanggan tidak terbatas",
    features: [
      "Semua fitur Pro",
      "Multi-tenant / white-label",
      "Custom domain",
      "SLA 99.9% uptime",
      "Dedicated support",
      "On-premise option",
    ],
    isPopular: false,
    ctaText: "Hubungi Sales",
    ctaLink: "mailto:sales@radpro.id",
  },
];

const DEFAULT_TESTIMONIALS: DefaultTestimonial[] = [
  {
    name: "Budi Santoso",
    role: "Owner, ISP Nusantara Net",
    content:
      "Sejak pakai RADPRO.ID, proses billing yang dulu manual jadi otomatis penuh. Tunggakan turun 60% dalam 3 bulan pertama.",
    rating: 5,
  },
  {
    name: "Dewi Rahayu",
    role: "Manager, Fiber Jaya Internet",
    content:
      "Integrasi MikroTik-nya luar biasa. Kami bisa remote konfigurasi ratusan router dari satu dashboard tanpa harus ke lapangan.",
    rating: 5,
  },
  {
    name: "Ahmad Fauzi",
    role: "Direktur, LinkNet Regional",
    content:
      "Portal pelanggan mandiri mengurangi beban CS kami hingga 40%. Pelanggan bisa bayar dan cek tagihan sendiri kapan saja.",
    rating: 5,
  },
];

const DEFAULT_FAQ: DefaultFaqItem[] = [
  {
    question: "Apakah RADPRO.ID cocok untuk ISP kecil?",
    answer:
      "Ya. Paket Starter gratis hingga 50 pelanggan, cocok untuk ISP yang baru mulai. Anda bisa upgrade kapan saja seiring pertumbuhan bisnis.",
  },
  {
    question: "Bagaimana cara integrasi dengan MikroTik?",
    answer:
      "Cukup masukkan IP, username, dan password RouterOS Anda di dashboard. RADPRO.ID akan terhubung via API RouterOS dan sinkronisasi data PPPoE secara otomatis.",
  },
  {
    question: "Apakah data pelanggan aman?",
    answer:
      "Data disimpan di server terenkripsi dengan backup harian. Setiap tenant memiliki isolasi data penuh — tidak ada data yang tercampur antar ISP.",
  },
  {
    question: "Bisakah saya menggunakan domain sendiri?",
    answer:
      "Ya, fitur custom domain tersedia di paket Enterprise. Pelanggan Anda akan mengakses portal dengan domain ISP Anda sendiri.",
  },
  {
    question: "Apakah ada kontrak jangka panjang?",
    answer:
      "Tidak. Semua paket berbasis bulanan dan bisa dibatalkan kapan saja tanpa penalti.",
  },
];

const DEFAULT_FOOTER: DefaultFooter = {
  companyName: "RADPRO.ID",
  description:
    "Platform manajemen ISP all-in-one untuk bisnis internet modern di Indonesia.",
  email: "sales@radpro.id",
  links: {
    Produk: [
      { label: "Fitur", href: "#features" },
      { label: "Harga", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
    Perusahaan: [
      { label: "Kontak", href: "mailto:sales@radpro.id" },
      { label: "Kebijakan Privasi", href: "/kebijakan-privasi" },
    ],
    Akun: [
      { label: "Login Admin", href: "/admin/login" },
      { label: "Portal Pelanggan", href: "/login" },
    ],
  },
};

// ── Props ──────────────────────────────────────────────────────────────────

interface SaasLandingPageProps {
  content: LandingContentAll | null;
}

/** SaaS marketing landing page for the main RADPRO.ID domain. */
export default function SaasLandingPage({ content }: SaasLandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Resolve content: DB values take precedence, fall back to defaults
  const hero = content?.hero ?? DEFAULT_HERO;
  const features: Array<DefaultFeature | LandingFeature> =
    content?.features && content.features.length > 0
      ? content.features
      : DEFAULT_FEATURES;
  const pricing: Array<DefaultPricing | LandingPricing> =
    content?.pricing && content.pricing.length > 0
      ? content.pricing
      : DEFAULT_PRICING;
  const testimonials: Array<DefaultTestimonial | LandingTestimonial> =
    content?.testimonials && content.testimonials.length > 0
      ? content.testimonials
      : DEFAULT_TESTIMONIALS;
  const faq: Array<DefaultFaqItem | LandingFaq> =
    content?.faq && content.faq.length > 0 ? content.faq : DEFAULT_FAQ;
  const footer: DefaultFooter | LandingFooter =
    content?.footer ?? DEFAULT_FOOTER;

  return (
    <div className="bg-white text-slate-900 font-sans antialiased overflow-x-hidden">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <MdRocketLaunch className="text-white text-lg" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900">
                RADPRO<span className="text-indigo-600">.ID</span>
              </span>
            </div>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
              >
                Fitur
              </a>
              <a
                href="#pricing"
                className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
              >
                Harga
              </a>
              <a
                href="#testimonials"
                className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
              >
                Testimoni
              </a>
              <a
                href="#faq"
                className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
              >
                FAQ
              </a>
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/admin/login"
                className="text-sm font-semibold text-slate-700 hover:text-indigo-600 transition-colors px-3 py-2"
              >
                Masuk
              </Link>
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-md"
              >
                <span>Coba Gratis</span>
                <MdArrowForward className="text-base" />
              </Link>
            </div>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <MdClose className="text-2xl" />
              ) : (
                <MdMenu className="text-2xl" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-3">
            <a
              href="#features"
              className="block text-sm font-medium text-slate-700 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Fitur
            </a>
            <a
              href="#pricing"
              className="block text-sm font-medium text-slate-700 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Harga
            </a>
            <a
              href="#testimonials"
              className="block text-sm font-medium text-slate-700 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Testimoni
            </a>
            <a
              href="#faq"
              className="block text-sm font-medium text-slate-700 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              FAQ
            </a>
            <Link
              href="/admin/login"
              className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors mt-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Coba Gratis Sekarang
            </Link>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-blue-50 pt-20 pb-28 px-4 sm:px-6 lg:px-8">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-100/40 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          {hero.badge && (
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold px-4 py-1.5 rounded-full mb-6 uppercase tracking-wider">
              <MdRocketLaunch className="text-sm" />
              {hero.badge}
            </div>
          )}

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-slate-900 mb-6">
            {hero.title}{" "}
            {hero.highlight && (
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">
                {hero.highlight}
              </span>
            )}
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-10">
            {hero.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={hero.ctaLink}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-xl text-base tracking-wide"
            >
              <span className="drop-shadow-sm">{hero.ctaPrimary}</span>
              <MdArrowForward className="text-lg" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 text-slate-700 hover:text-indigo-600 font-semibold px-6 py-3.5 rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors text-base bg-white"
            >
              {hero.ctaSecondary}
            </a>
          </div>

          {/* Social proof bar */}
          <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <MdStar key={i} className="text-base" />
                ))}
              </div>
              <span className="font-semibold text-slate-700">4.9/5</span>
              <span>dari 200+ ISP</span>
            </div>
            <div className="hidden sm:block w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <MdCheck className="text-green-500 text-base" />
              <span>Tanpa kartu kredit</span>
            </div>
            <div className="hidden sm:block w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <MdCheck className="text-green-500 text-base" />
              <span>Setup dalam 5 menit</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-indigo-600 font-bold text-sm uppercase tracking-widest mb-3">
              Fitur Lengkap
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
              Semua yang Anda butuhkan untuk mengelola ISP
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Dari billing hingga monitoring jaringan real-time, RADPRO.ID hadir
              sebagai satu-satunya platform yang Anda perlukan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => {
              const IconComponent = ICON_MAP[feature.icon] || MdBusiness;
              const color =
                "color" in feature
                  ? (feature as { color: string }).color
                  : FEATURE_COLORS[idx % FEATURE_COLORS.length];
              return (
                <div
                  key={feature.title}
                  className="group p-6 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-300 bg-white"
                >
                  <div
                    className={`w-14 h-14 rounded-xl ${color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <IconComponent className="text-3xl" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-indigo-600 font-bold text-sm uppercase tracking-widest mb-3">
              Harga Transparan
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
              Pilih paket yang sesuai kebutuhan
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Mulai gratis, upgrade kapan saja. Tidak ada biaya tersembunyi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {pricing.map((plan) => {
              if (plan.isPopular) {
                return (
                  <div
                    key={plan.name}
                    className="bg-indigo-600 rounded-2xl p-8 shadow-xl shadow-indigo-200 relative"
                  >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-extrabold px-4 py-1 rounded-full uppercase tracking-wider">
                      Paling Populer
                    </div>
                    <p className="text-sm font-bold text-indigo-200 uppercase tracking-wider mb-2">
                      {plan.name}
                    </p>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-4xl font-extrabold text-white">
                        {plan.price}
                      </span>
                    </div>
                    <p className="text-indigo-200 text-sm mb-6">
                      {plan.period}
                    </p>
                    <ul className="space-y-3 mb-8">
                      {plan.features.map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-2.5 text-sm text-indigo-100"
                        >
                          <MdCheck className="text-indigo-300 text-base shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={plan.ctaLink}
                      className="block w-full text-center bg-white hover:bg-indigo-50 text-indigo-700 font-bold py-2.5 rounded-xl transition-colors text-sm"
                    >
                      {plan.ctaText}
                    </Link>
                  </div>
                );
              }

              const isExternal = plan.ctaLink.startsWith("mailto:");
              return (
                <div
                  key={plan.name}
                  className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm"
                >
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {plan.name}
                  </p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-extrabold text-slate-900">
                      {plan.price}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm mb-6">{plan.period}</p>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-2.5 text-sm text-slate-600"
                      >
                        <MdCheck className="text-green-500 text-base shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  {isExternal ? (
                    <a
                      href={plan.ctaLink}
                      className="block w-full text-center border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 font-semibold py-2.5 rounded-xl transition-colors text-sm"
                    >
                      {plan.ctaText}
                    </a>
                  ) : (
                    <Link
                      href={plan.ctaLink}
                      className="block w-full text-center border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 font-semibold py-2.5 rounded-xl transition-colors text-sm"
                    >
                      {plan.ctaText}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section
        id="testimonials"
        className="py-24 px-4 sm:px-6 lg:px-8 bg-white"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-indigo-600 font-bold text-sm uppercase tracking-widest mb-3">
              Testimoni
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
              Dipercaya ratusan ISP di Indonesia
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-slate-50 rounded-2xl p-6 border border-slate-100"
              >
                <div className="flex text-amber-400 mb-4">
                  {[...Array(t.rating)].map((_, i) => (
                    <MdStar key={i} className="text-base" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-5 italic">
                  &ldquo;{t.content}&rdquo;
                </p>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t.name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-indigo-600 font-bold text-sm uppercase tracking-widest mb-3">
              FAQ
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
              Pertanyaan yang sering ditanyakan
            </h2>
          </div>

          <div className="space-y-3">
            {faq.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
              >
                <button
                  className="w-full flex justify-between items-center p-5 text-left"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  aria-expanded={openFaq === idx}
                >
                  <span className="font-bold text-slate-900 text-[15px] pr-4">
                    {item.question}
                  </span>
                  <MdExpandMore
                    className={`text-slate-400 text-2xl shrink-0 transition-transform duration-200 ${openFaq === idx ? "rotate-180" : ""}`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 text-slate-500 text-sm leading-relaxed border-t border-slate-50 pt-3">
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-600 to-blue-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Siap transformasi bisnis ISP Anda?
          </h2>
          <p className="text-indigo-100 text-lg mb-10 max-w-xl mx-auto">
            Bergabung dengan 200+ ISP yang sudah menggunakan RADPRO.ID. Mulai
            gratis, tanpa kartu kredit.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-2 bg-white hover:bg-indigo-50 text-indigo-700 font-bold px-8 py-3.5 rounded-xl transition-colors shadow-lg text-base"
            >
              Mulai Gratis 14 Hari
              <MdArrowForward className="text-lg" />
            </Link>
            <a
              href="mailto:sales@radpro.id"
              className="inline-flex items-center gap-2 border border-white/30 hover:border-white/60 text-white font-semibold px-6 py-3.5 rounded-xl transition-colors text-base"
            >
              Hubungi Sales
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-10">
            {/* Brand */}
            <div className="max-w-xs">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center">
                  <MdRocketLaunch className="text-white text-sm" />
                </div>
                <span className="font-extrabold text-lg text-white">
                  {footer.companyName}
                </span>
              </div>
              {footer.description && (
                <p className="text-sm leading-relaxed">{footer.description}</p>
              )}
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              {Object.entries(footer.links).map(([groupLabel, items]) => (
                <div key={groupLabel}>
                  <p className="font-semibold text-white mb-3">{groupLabel}</p>
                  <ul className="space-y-2">
                    {items.map((link) => (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          className="hover:text-white transition-colors"
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

          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <p>
              © {new Date().getFullYear()} {footer.companyName}. All rights
              reserved.
            </p>
            <p className="text-slate-500">
              Terdaftar dan diawasi oleh Kominfo.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
