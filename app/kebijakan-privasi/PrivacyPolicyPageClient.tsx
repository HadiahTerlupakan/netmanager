"use client";

import Link from "next/link";
import Image from "next/image";
import { MdArrowBack } from "react-icons/md";
import {
  DEFAULT_PUBLIC_APP_LOGO_URL,
  DEFAULT_PUBLIC_APP_NAME,
  usePublicBranding,
} from "@/hooks/usePublicBranding";

export default function PrivacyPolicyPageClient() {
  const { branding } = usePublicBranding();
  const appLogoUrl = branding?.appLogoUrl || DEFAULT_PUBLIC_APP_LOGO_URL;
  const appName = branding?.namaAplikasi || DEFAULT_PUBLIC_APP_NAME;

  return (
    <div className="bg-slate-50 dark:bg-[#101922] text-slate-900 dark:text-white font-sans antialiased min-h-screen pb-20">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#101922]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <MdArrowBack className="text-2xl text-slate-600 dark:text-slate-300" />
              </Link>
              <Link href="/">
                <Image
                  src={appLogoUrl}
                  alt={appName}
                  width={120}
                  height={38}
                  className="h-8 w-auto object-contain"
                />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 sm:p-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
            Kebijakan Privasi
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">
            Terakhir diperbarui:{" "}
            {new Date().toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="text-slate-700 dark:text-slate-300 text-base sm:text-lg leading-relaxed mb-8">
              Aplikasi NetManager (&quot;Aplikasi&quot;) dibangun dan
              dioperasikan oleh SBL NET (PT Surya Bintang Langit). Kebijakan
              Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan,
              dan melindungi informasi Anda saat menggunakan Aplikasi kami dan
              layanan internet kami.
            </p>

            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                1. Informasi yang Kami Kumpulkan
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">
                Saat mendaftar dan menggunakan layanan atau Aplikasi kami, kami
                dapat mengumpulkan informasi pribadi yang dapat mengidentifikasi
                Anda secara langsung maupun tidak langsung, termasuk namun tidak
                terbatas pada:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                <li>Nama lengkap dan nama pengguna (username)</li>
                <li>Alamat penagihan dan instalasi</li>
                <li>Alamat email dan nomor telepon (WhatsApp)</li>
                <li>
                  Data biometrik (sidik jari/pengenalan wajah, jika diaktifkan
                  untuk otentikasi aplikasi internal)
                </li>
                <li>
                  Data lokasi (GPS) yang digunakan eksklusif untuk fitur
                  penugasan teknisi dan sales di lapangan.
                </li>
                <li>
                  Foto dan dokumen identitas (KTP) untuk keperluan registrasi
                  langganan.
                </li>
                <li>
                  Informasi teknis terkait jenis perangkat, sistem operasi,
                  status router, dan log jaringan layanan berlangganan.
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                2. Izin Perangkat (Untuk Aplikasi Mobile)
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">
                Agar aplikasi klien/staf berfungsi memadai di perangkat mobile
                (Android/iOS), Aplikasi memerlukan beberapa izin akses:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                <li>
                  <strong>Kamera:</strong> Digunakan untuk mengambil foto wajah
                  saat presensi pegawai, laporan pekerjaan instalasi, profil,
                  atau mengajukan keluhan/bukti masalah jaringan.
                </li>
                <li>
                  <strong>Lokasi:</strong> Digunakan untuk menemukan ODP
                  (Optical Distribution Point) terdekat untuk calon pelanggan
                  dan check-in lapangan staf teknisi.
                </li>
                <li>
                  <strong>Penyimpanan (Storage):</strong> Digunakan untuk
                  menyimpan faktur digital (invoice) atau mengunggah bukti
                  pembayaran layanan internet.
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                3. Penggunaan Informasi
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Informasi yang kami kumpulkan digunakan semata-mata untuk
                mengaktifkan pasokan layanan internet fiber optik Anda,
                menangani tagihan dan pembayaran, mengirim notifikasi perbaikan
                jaringan, dan meningkatkan sistem operasional Aplikasi bagi staf
                dan pelanggan kami. Kami tidak pernah menjual atau membagikan
                data kepada pihak ketiga pemasang iklan atau entitas yang tidak
                terafiliasi tanpa persetujuan jelas.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                4. Keamanan Data
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Kami menerapkan langkah-langkah keamanan teknis dan
                administratif yang kuat sesuai standar industri untuk melindungi
                data Anda dari akses, pengubahan, pengungkapan, atau
                penghancuran tanpa izin. Server backend NetManager dikonfigurasi
                untuk melindungi kerahasiaan komunikasi data finansial dan
                penagihan Anda.
              </p>
            </section>

            <section>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                5. Hubungi Kami
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Jika Anda memiliki pertanyaan atau kekhawatiran tentang
                pengolahan data atau Kebijakan Privasi ini, silakan hubungi kami
                melalui:
                <br />
                <br />
                <strong>PT Surya Bintang Langit (SBL NET)</strong>
                <br />
                Jl. Prof. Dr. Soepomo No.73B, Menteng Dalam, Tebet, Jakarta
                Selatan
                <br />
                Telepon: 021-83705900
                <br />
                Email: care@sblnet.id
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
