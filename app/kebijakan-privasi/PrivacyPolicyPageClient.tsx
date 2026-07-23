"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const LAST_UPDATED = "23 Juli 2026";
const CONTACT_EMAIL = "sales@radpro.id";
const SITE_NAME = "RADPRO.ID";
const SITE_URL = "https://radpro.id";

/** Kebijakan privasi publik untuk platform SaaS RADPRO.ID (bukan ISP). */
export default function PrivacyPolicyPageClient() {
  return (
    <div className="min-h-[100dvh] bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Kembali
          </Link>
          <span className="text-sm font-semibold tracking-tight">
            {SITE_NAME}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <article className="rounded-[1.5rem] border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900 sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            Kebijakan Privasi
          </h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Terakhir diperbarui: {LAST_UPDATED}
          </p>

          <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">
            <p>
              Kebijakan Privasi ini menjelaskan bagaimana{" "}
              <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                {SITE_NAME}
              </strong>{" "}
              (&quot;kami&quot;) mengumpulkan, menggunakan, menyimpan, dan
              melindungi data pribadi saat Anda mengunjungi situs{" "}
              <a
                href={SITE_URL}
                className="font-medium text-[#0a46aa] underline-offset-4 hover:underline dark:text-[#5b8def]"
              >
                {SITE_URL}
              </a>{" "}
              atau menggunakan platform SaaS manajemen ISP kami (web admin,
              portal pelanggan, dan layanan terkait).
            </p>

            <div className="rounded-xl border border-[#0a46aa]/15 bg-[#0a46aa]/[0.06] p-4 text-sm dark:border-[#5b8def]/20 dark:bg-[#5b8def]/10">
              <p>
                <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Ringkasan:
                </strong>{" "}
                RADPRO.ID adalah platform perangkat lunak (SaaS) untuk
                operasional ISP. Kami{" "}
                <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                  bukan
                </strong>{" "}
                penyedia layanan internet. Data yang Anda masukkan di platform
                digunakan untuk menyediakan layanan SaaS kepada akun Anda, bukan
                untuk menjual data ke pihak ketiga.
              </p>
            </div>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                1. Ruang lingkup
              </h2>
              <p className="mb-3">Kebijakan ini berlaku untuk:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Situs pemasaran dan dokumentasi publik RADPRO.ID</li>
                <li>
                  Panel admin, portal pelanggan, API, dan integrasi yang kami
                  sediakan sebagai bagian dari layanan SaaS
                </li>
                <li>
                  Komunikasi terkait layanan (email, WhatsApp, atau kanal
                  support lain yang Anda pilih)
                </li>
              </ul>
              <p className="mt-3">
                Untuk aplikasi mobile karyawan RADPRO, lihat juga{" "}
                <Link
                  href="/kebijakan-privasi-aplikasi"
                  className="font-medium text-[#0a46aa] underline-offset-4 hover:underline dark:text-[#5b8def]"
                >
                  Kebijakan Privasi Aplikasi
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                2. Data yang kami kumpulkan
              </h2>
              <p className="mb-3">
                Jenis data bergantung pada bagaimana Anda berinteraksi dengan
                layanan:
              </p>

              <h3 className="mb-2 mt-4 text-base font-semibold text-zinc-800 dark:text-zinc-200">
                2.1 Pengunjung situs
              </h3>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Data teknis dasar: alamat IP, jenis browser, sistem operasi,
                  halaman yang dikunjungi, dan waktu akses (log server /
                  analitik jika diaktifkan)
                </li>
                <li>
                  Cookie atau penyimpanan lokal yang diperlukan untuk preferensi
                  (misalnya tema tampilan) dan keamanan sesi
                </li>
              </ul>

              <h3 className="mb-2 mt-4 text-base font-semibold text-zinc-800 dark:text-zinc-200">
                2.2 Akun pelanggan SaaS (admin / staf)
              </h3>
              <ul className="list-disc space-y-2 pl-5">
                <li>Identitas akun: nama, email, nomor telepon</li>
                <li>Kredensial autentikasi (kata sandi disimpan ter-hash)</li>
                <li>
                  Peran, izin, dan aktivitas operasional di dalam platform
                </li>
                <li>
                  Data yang Anda unggah atau catat untuk menjalankan bisnis ISP
                  Anda (misalnya data pelanggan, tagihan, perangkat jaringan) —
                  data ini milik akun/tenant Anda
                </li>
              </ul>

              <h3 className="mb-2 mt-4 text-base font-semibold text-zinc-800 dark:text-zinc-200">
                2.3 Pengguna portal pelanggan (end-user ISP)
              </h3>
              <p>
                Jika ISP Anda memakai portal pelanggan RADPRO, data pelanggan
                akhir (tagihan, tiket, status layanan, dll.) diproses atas
                instruksi dan tanggung jawab ISP yang menjadi pelanggan SaaS
                kami (sebagai pengendali data untuk pelanggan mereka).
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                3. Cara kami menggunakan data
              </h2>
              <ul className="list-disc space-y-2 pl-5">
                <li>Menyediakan, memelihara, dan mengamankan layanan SaaS</li>
                <li>Autentikasi, otorisasi, dan pencegahan penyalahgunaan</li>
                <li>
                  Dukungan pelanggan, notifikasi layanan, dan komunikasi penting
                  terkait akun
                </li>
                <li>
                  Meningkatkan keandalan, performa, dan fitur produk (termasuk
                  log error/diagnostik)
                </li>
                <li>Memenuhi kewajiban hukum yang berlaku</li>
              </ul>
              <p className="mt-3">
                Kami tidak menjual data pribadi Anda kepada pihak ketiga untuk
                iklan.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                4. Pembagian data
              </h2>
              <p className="mb-3">
                Kami dapat membagikan data hanya sebatas yang diperlukan kepada:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Penyedia infrastruktur yang membantu menjalankan layanan
                  (hosting, email, penyimpanan, monitoring) — terikat kewajiban
                  kerahasiaan
                </li>
                <li>
                  Integrasi yang Anda aktifkan sendiri (misalnya payment
                  gateway, WhatsApp gateway, perangkat jaringan)
                </li>
                <li>
                  Otoritas berwenang jika diwajibkan hukum atau proses hukum
                  yang sah
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                5. Penyimpanan &amp; keamanan
              </h2>
              <p>
                Data disimpan di server yang kami kelola atau penyedia cloud
                yang kami gunakan. Kami menerapkan kontrol akses, enkripsi pada
                transmisi (HTTPS), hashing kata sandi, dan isolasi data per akun
                tenant. Tidak ada sistem yang 100% aman; kami terus memperbaiki
                praktik keamanan seiring perkembangan ancaman.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                6. Retensi data
              </h2>
              <p>
                Data akun dan operasional disimpan selama akun aktif dan selama
                diperlukan untuk menyediakan layanan, memenuhi kewajiban hukum,
                atau menyelesaikan sengketa. Setelah penutupan akun, data dapat
                dihapus atau dianonimkan dalam jangka waktu yang wajar sesuai
                kebijakan retensi internal, kecuali hukum mewajibkan penyimpanan
                lebih lama.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                7. Hak Anda
              </h2>
              <p className="mb-3">
                Sesuai ketentuan hukum yang berlaku di Indonesia, Anda dapat
                meminta:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Akses atau salinan data pribadi yang kami proses</li>
                <li>Perbaikan data yang tidak akurat</li>
                <li>
                  Penghapusan atau pembatasan pemrosesan, sepanjang tidak
                  bertentangan dengan kewajiban hukum atau kebutuhan layanan
                </li>
                <li>
                  Penarikan persetujuan (jika pemrosesan berbasis persetujuan)
                </li>
              </ul>
              <p className="mt-3">
                Ajukan permintaan melalui kontak di bagian 10. Untuk data
                pelanggan akhir ISP, hubungi ISP yang mengelola akun Anda —
                mereka adalah pihak yang mengendalikan data tersebut.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                8. Cookie &amp; preferensi
              </h2>
              <p>
                Kami menggunakan cookie/penyimpanan sesi yang diperlukan agar
                login dan preferensi tampilan berfungsi. Jika di kemudian hari
                kami menambahkan cookie analitik opsional, kami akan
                menyesuaikan kebijakan ini dan memberikan pilihan yang sesuai.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                9. Perubahan kebijakan
              </h2>
              <p>
                Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke
                waktu. Tanggal &quot;Terakhir diperbarui&quot; di atas akan
                diubah. Perubahan material akan diumumkan melalui situs atau
                notifikasi layanan bila memungkinkan.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                10. Hubungi kami
              </h2>
              <p>Pertanyaan tentang Kebijakan Privasi ini dapat dikirim ke:</p>
              <p className="mt-3">
                <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {SITE_NAME}
                </strong>
                <br />
                Email:{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-medium text-[#0a46aa] underline-offset-4 hover:underline dark:text-[#5b8def]"
                >
                  {CONTACT_EMAIL}
                </a>
                <br />
                Situs:{" "}
                <a
                  href={SITE_URL}
                  className="font-medium text-[#0a46aa] underline-offset-4 hover:underline dark:text-[#5b8def]"
                >
                  {SITE_URL}
                </a>
              </p>
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                Dokumen ini adalah kebijakan privasi untuk layanan SaaS
                RADPRO.ID. Dokumen ini tidak menyatakan status perizinan
                telekomunikasi atau pengawasan regulator tertentu.
              </p>
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}
