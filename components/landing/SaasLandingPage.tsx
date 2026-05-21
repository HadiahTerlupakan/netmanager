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

/** SaaS marketing landing page for the main RADPRO.ID domain. */
export default function SaasLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                Coba Gratis
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
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold px-4 py-1.5 rounded-full mb-6 uppercase tracking-wider">
            <MdRocketLaunch className="text-sm" />
            Platform ISP All-in-One
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-slate-900 mb-6">
            Kelola ISP Anda{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">
              Lebih Cerdas
            </span>
            <br />
            dalam Satu Platform
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-10">
            Billing otomatis, manajemen jaringan MikroTik & OLT, portal
            pelanggan, dan manajemen karyawan — semua terintegrasi untuk ISP
            modern.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3.5 rounded-xl transition-colors shadow-lg shadow-indigo-200 text-base"
            >
              Mulai Gratis 14 Hari
              <MdArrowForward className="text-lg" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 text-slate-700 hover:text-indigo-600 font-semibold px-6 py-3.5 rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors text-base bg-white"
            >
              Lihat Fitur
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
            {[
              {
                icon: <MdReceiptLong className="text-3xl" />,
                color: "bg-indigo-50 text-indigo-600",
                title: "Billing & Invoicing Otomatis",
                desc: "Generate tagihan bulanan secara otomatis, kirim notifikasi jatuh tempo, dan terima pembayaran via berbagai metode.",
              },
              {
                icon: <MdRouter className="text-3xl" />,
                color: "bg-blue-50 text-blue-600",
                title: "Manajemen Jaringan",
                desc: "Integrasi langsung dengan MikroTik RouterOS dan OLT. Kelola PPPoE, bandwidth, dan konfigurasi perangkat dari satu dashboard.",
              },
              {
                icon: <MdPeople className="text-3xl" />,
                color: "bg-violet-50 text-violet-600",
                title: "Portal Pelanggan",
                desc: "Pelanggan dapat cek tagihan, bayar, buat tiket gangguan, dan pantau status layanan mandiri tanpa menghubungi CS.",
              },
              {
                icon: <MdAccessTime className="text-3xl" />,
                color: "bg-emerald-50 text-emerald-600",
                title: "Manajemen Karyawan",
                desc: "Absensi, shift, lembur, dan penggajian karyawan terintegrasi. Kelola tim teknisi lapangan dengan mudah.",
              },
              {
                icon: <MdMonitor className="text-3xl" />,
                color: "bg-amber-50 text-amber-600",
                title: "Monitoring Real-time",
                desc: "Pantau status perangkat, trafik jaringan, dan uptime layanan secara real-time dengan alert otomatis.",
              },
              {
                icon: <MdBusiness className="text-3xl" />,
                color: "bg-rose-50 text-rose-600",
                title: "Multi-tenant",
                desc: "Satu platform untuk banyak ISP. Setiap tenant punya domain, branding, dan data yang terisolasi penuh.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-300 bg-white"
              >
                <div
                  className={`w-14 h-14 rounded-xl ${feature.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                >
                  {feature.icon}
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
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
            {/* Starter */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                Starter
              </p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-extrabold text-slate-900">
                  Gratis
                </span>
              </div>
              <p className="text-slate-400 text-sm mb-6">Hingga 50 pelanggan</p>
              <ul className="space-y-3 mb-8">
                {[
                  "Billing otomatis",
                  "Portal pelanggan",
                  "1 admin user",
                  "Support email",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2.5 text-sm text-slate-600"
                  >
                    <MdCheck className="text-green-500 text-base shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/admin/login"
                className="block w-full text-center border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                Mulai Gratis
              </Link>
            </div>

            {/* Pro — highlighted */}
            <div className="bg-indigo-600 rounded-2xl p-8 shadow-xl shadow-indigo-200 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-extrabold px-4 py-1 rounded-full uppercase tracking-wider">
                Paling Populer
              </div>
              <p className="text-sm font-bold text-indigo-200 uppercase tracking-wider mb-2">
                Pro
              </p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-extrabold text-white">
                  Rp 499K
                </span>
              </div>
              <p className="text-indigo-200 text-sm mb-6">
                per bulan · hingga 500 pelanggan
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Semua fitur Starter",
                  "Integrasi MikroTik & OLT",
                  "Manajemen karyawan",
                  "Monitoring real-time",
                  "5 admin user",
                  "Support prioritas",
                ].map((item) => (
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
                href="/admin/login"
                className="block w-full text-center bg-white hover:bg-indigo-50 text-indigo-700 font-bold py-2.5 rounded-xl transition-colors text-sm"
              >
                Coba 14 Hari Gratis
              </Link>
            </div>

            {/* Enterprise */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                Enterprise
              </p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-extrabold text-slate-900">
                  Custom
                </span>
              </div>
              <p className="text-slate-400 text-sm mb-6">
                Pelanggan tidak terbatas
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Semua fitur Pro",
                  "Multi-tenant / white-label",
                  "Custom domain",
                  "SLA 99.9% uptime",
                  "Dedicated support",
                  "On-premise option",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2.5 text-sm text-slate-600"
                  >
                    <MdCheck className="text-green-500 text-base shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="mailto:sales@radpro.id"
                className="block w-full text-center border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                Hubungi Sales
              </a>
            </div>
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
            {[
              {
                name: "Budi Santoso",
                role: "Owner, ISP Nusantara Net",
                quote:
                  "Sejak pakai RADPRO.ID, proses billing yang dulu manual jadi otomatis penuh. Tunggakan turun 60% dalam 3 bulan pertama.",
              },
              {
                name: "Dewi Rahayu",
                role: "Manager, Fiber Jaya Internet",
                quote:
                  "Integrasi MikroTik-nya luar biasa. Kami bisa remote konfigurasi ratusan router dari satu dashboard tanpa harus ke lapangan.",
              },
              {
                name: "Ahmad Fauzi",
                role: "Direktur, LinkNet Regional",
                quote:
                  "Portal pelanggan mandiri mengurangi beban CS kami hingga 40%. Pelanggan bisa bayar dan cek tagihan sendiri kapan saja.",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="bg-slate-50 rounded-2xl p-6 border border-slate-100"
              >
                <div className="flex text-amber-400 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <MdStar key={i} className="text-base" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-5 italic">
                  &ldquo;{t.quote}&rdquo;
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
            {[
              {
                q: "Apakah RADPRO.ID cocok untuk ISP kecil?",
                a: "Ya. Paket Starter gratis hingga 50 pelanggan, cocok untuk ISP yang baru mulai. Anda bisa upgrade kapan saja seiring pertumbuhan bisnis.",
              },
              {
                q: "Bagaimana cara integrasi dengan MikroTik?",
                a: "Cukup masukkan IP, username, dan password RouterOS Anda di dashboard. RADPRO.ID akan terhubung via API RouterOS dan sinkronisasi data PPPoE secara otomatis.",
              },
              {
                q: "Apakah data pelanggan aman?",
                a: "Data disimpan di server terenkripsi dengan backup harian. Setiap tenant memiliki isolasi data penuh — tidak ada data yang tercampur antar ISP.",
              },
              {
                q: "Bisakah saya menggunakan domain sendiri?",
                a: "Ya, fitur custom domain tersedia di paket Enterprise. Pelanggan Anda akan mengakses portal dengan domain ISP Anda sendiri.",
              },
              {
                q: "Apakah ada kontrak jangka panjang?",
                a: "Tidak. Semua paket berbasis bulanan dan bisa dibatalkan kapan saja tanpa penalti.",
              },
            ].map((item, idx) => (
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
                    {item.q}
                  </span>
                  <MdExpandMore
                    className={`text-slate-400 text-2xl shrink-0 transition-transform duration-200 ${openFaq === idx ? "rotate-180" : ""}`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 text-slate-500 text-sm leading-relaxed border-t border-slate-50 pt-3">
                    {item.a}
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
                  RADPRO<span className="text-indigo-400">.ID</span>
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                Platform manajemen ISP all-in-one untuk bisnis internet modern
                di Indonesia.
              </p>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              <div>
                <p className="font-semibold text-white mb-3">Produk</p>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="#features"
                      className="hover:text-white transition-colors"
                    >
                      Fitur
                    </a>
                  </li>
                  <li>
                    <a
                      href="#pricing"
                      className="hover:text-white transition-colors"
                    >
                      Harga
                    </a>
                  </li>
                  <li>
                    <a
                      href="#faq"
                      className="hover:text-white transition-colors"
                    >
                      FAQ
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-3">Perusahaan</p>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="mailto:sales@radpro.id"
                      className="hover:text-white transition-colors"
                    >
                      Kontak
                    </a>
                  </li>
                  <li>
                    <Link
                      href="/kebijakan-privasi"
                      className="hover:text-white transition-colors"
                    >
                      Kebijakan Privasi
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-3">Akun</p>
                <ul className="space-y-2">
                  <li>
                    <Link
                      href="/admin/login"
                      className="hover:text-white transition-colors"
                    >
                      Login Admin
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/login"
                      className="hover:text-white transition-colors"
                    >
                      Portal Pelanggan
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <p>© {new Date().getFullYear()} RADPRO.ID. All rights reserved.</p>
            <p className="text-slate-500">
              Terdaftar dan diawasi oleh Kominfo.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
