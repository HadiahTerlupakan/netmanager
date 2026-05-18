"use client";

import Link from "next/link";
import Image from "next/image";
import { MdArrowBack } from "react-icons/md";
import {
  DEFAULT_PUBLIC_APP_LOGO_URL,
  DEFAULT_PUBLIC_APP_NAME,
  usePublicBranding,
} from "@/hooks/usePublicBranding";

export default function PrivacyPolicyMobileClient() {
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
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
            Kebijakan Privasi Aplikasi RADPRO
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 font-medium">
            Aplikasi:{" "}
            <code className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">
              com.netmanager.mobile
            </code>
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">
            Berlaku efektif:{" "}
            {new Date().toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="text-slate-700 dark:text-slate-300 text-base sm:text-lg leading-relaxed mb-6">
              Aplikasi <strong>RADPRO</strong> (&quot;Aplikasi&quot;) dibangun
              dan dioperasikan oleh RADPRO (&quot;kami&quot;,
              &quot;Pengembang&quot;). Kebijakan Privasi ini menjelaskan
              bagaimana kami mengumpulkan, menggunakan, melindungi, dan
              membagikan informasi Anda saat menggunakan Aplikasi yang tersedia
              di Google Play Store.
            </p>

            <div className="bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-500 p-4 rounded-lg mb-8">
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>Ringkasan singkat:</strong> RADPRO adalah aplikasi
                internal manajemen karyawan dan pelanggan untuk perusahaan
                ISP/telekomunikasi. Data yang dikumpulkan digunakan eksklusif
                untuk operasional perusahaan (absensi, work order, payroll).
                Kami tidak menjual data Anda ke pihak ketiga.
              </p>
            </div>

            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                1. Informasi yang Kami Kumpulkan
              </h2>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">
                1.1. Data Identitas
              </h3>
              <ul className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                <li>Nama lengkap dan nama pengguna (username)</li>
                <li>Alamat email dan nomor telepon</li>
                <li>Foto profil dan ID karyawan</li>
                <li>Data jabatan dan departemen</li>
              </ul>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">
                1.2. Data Biometrik
              </h3>
              <ul className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
                <li>
                  Sidik jari atau pengenalan wajah (Face ID) yang Anda aktifkan
                  untuk login cepat — diproses lokal di perangkat
                </li>
                <li>
                  Foto wajah yang diambil saat absensi (face verification)
                </li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Data biometrik diproses secara lokal di perangkat Anda dan/atau
                server kami, hanya untuk verifikasi identitas Anda.
              </p>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">
                1.3. Data Lokasi
              </h3>
              <ul className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                <li>
                  <strong>Foreground location:</strong> saat Anda melakukan
                  absensi masuk/pulang dan mencatat penyelesaian work order.
                </li>
                <li>
                  <strong>Background location:</strong> hanya saat fitur
                  pelacakan work order aktif dan Anda dalam status &quot;On
                  Duty&quot;. Tidak dikumpulkan saat Anda offline atau di luar
                  jam kerja.
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">
                1.4. Data Media (Kamera & Foto)
              </h3>
              <ul className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                <li>
                  Foto dari kamera untuk: absensi, laporan work order, bukti
                  reimbursement, dokumentasi pemasangan jaringan
                </li>
                <li>
                  Akses galeri foto bila Anda memilih mengunggah foto dari
                  penyimpanan perangkat
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">
                1.5. Data Teknis
              </h3>
              <ul className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                <li>
                  Jenis perangkat, model, sistem operasi, dan versi aplikasi
                </li>
                <li>
                  Identifier perangkat (untuk push notification dan App Check)
                </li>
                <li>
                  Log aktivitas, crash reports, dan error logs (troubleshooting)
                </li>
                <li>Status koneksi jaringan</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                2. Izin Perangkat (Permissions)
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">
                Aplikasi memerlukan beberapa izin untuk berfungsi. Anda dapat
                mencabut izin ini kapan saja melalui pengaturan sistem
                perangkat.
              </p>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
                2.1. Kamera
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                Untuk mengambil foto wajah saat absensi, mendokumentasikan hasil
                pekerjaan, dan mengunggah bukti pengeluaran. Akses kamera{" "}
                <strong>tidak digunakan</strong> untuk perekaman audio.
              </p>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
                2.2. Lokasi (Foreground & Background)
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
                Digunakan untuk:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                <li>Memverifikasi lokasi saat absensi masuk/pulang</li>
                <li>Mencatat lokasi penyelesaian work order di lapangan</li>
                <li>
                  Pelacakan rute teknisi saat fitur &quot;On Duty&quot; aktif
                  (background location)
                </li>
              </ul>
              <div className="bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-500 p-4 rounded-lg mb-4">
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  <strong>Background location:</strong> Lokasi di latar belakang
                  hanya dikumpulkan saat Anda secara eksplisit mengaktifkan
                  status &quot;On Duty&quot; untuk work order. Anda dapat
                  menonaktifkan kapan saja dengan menyelesaikan atau membatalkan
                  work order. Data lokasi tidak dikumpulkan di luar konteks
                  pekerjaan.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
                2.3. Penyimpanan (Media)
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                Untuk menyimpan file yang diunduh (struk gaji, ID card) dan
                mengakses galeri bila Anda mengunggah foto. Aplikasi{" "}
                <strong>tidak</strong> mengakses file di luar direktori media.
              </p>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
                2.4. Notifikasi
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                Untuk mengirim notifikasi tentang work order baru, persetujuan
                reimbursement, perubahan jadwal, dan pesan dari rekan kerja.
              </p>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
                2.5. Biometrik (Sidik Jari / Face ID)
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Opsional, untuk login cepat tanpa mengetik password. Data
                biometrik tetap di perangkat Anda dan tidak dikirim ke server
                kami.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                3. Penggunaan Informasi
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
                Informasi yang kami kumpulkan digunakan untuk:
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                <li>Mengelola kehadiran staf (absensi, lembur, izin)</li>
                <li>Melacak penugasan dan penyelesaian work order</li>
                <li>Mengelola insentif, gaji, dan reimbursement</li>
                <li>Manajemen pelanggan dan instalasi jaringan</li>
                <li>Komunikasi internal antar karyawan (chat, notifikasi)</li>
                <li>
                  Meningkatkan keamanan Aplikasi (App Check, fraud detection)
                </li>
                <li>Troubleshooting dan perbaikan bug (crash logs)</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                4. Pembagian Data dengan Pihak Ketiga
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">
                Kami menggunakan layanan pihak ketiga berikut untuk mendukung
                operasional Aplikasi:
              </p>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
                4.1. Google Firebase (Google LLC)
              </h3>
              <ul className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
                <li>
                  <strong>Firebase Cloud Messaging:</strong> push notification
                </li>
                <li>
                  <strong>Firebase Realtime Database / Firestore:</strong>{" "}
                  sinkronisasi data real-time (chat, presence)
                </li>
                <li>
                  <strong>Firebase App Check:</strong> verifikasi keaslian
                  aplikasi
                </li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                Kebijakan privasi Google:{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  https://policies.google.com/privacy
                </a>
              </p>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
                4.2. Sentry (Functional Software, Inc.)
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
                Untuk crash reporting dan error tracking. Data yang dikirim:
                stack trace, device info, dan user ID. Header Authorization dan
                Cookie di-strip sebelum pengiriman — tidak ada token atau
                password yang ter-log.
              </p>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                Kebijakan privasi Sentry:{" "}
                <a
                  href="https://sentry.io/privacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  https://sentry.io/privacy/
                </a>
              </p>

              <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-semibold">
                Kami tidak menjual data Anda ke pihak ketiga manapun.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                5. Penyimpanan dan Retensi Data
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
                Data Anda disimpan di server kami selama Anda menjadi
                karyawan/pengguna aktif dan untuk periode berikut setelah
                berhenti:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                <li>
                  <strong>Data presensi dan payroll:</strong> 5 tahun (untuk
                  audit dan compliance pajak)
                </li>
                <li>
                  <strong>Data work order:</strong> 3 tahun (untuk layanan purna
                  jual pelanggan)
                </li>
                <li>
                  <strong>Data biometrik:</strong> dihapus segera setelah Anda
                  berhenti atau menonaktifkan fitur
                </li>
                <li>
                  <strong>Crash logs dan error reports:</strong> 90 hari
                </li>
                <li>
                  <strong>Log aktivitas:</strong> 1 tahun
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                6. Keamanan Data
              </h2>
              <ul className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                <li>Enkripsi data saat transmisi (HTTPS/TLS 1.2+)</li>
                <li>
                  Enkripsi data sensitif saat penyimpanan (at-rest encryption)
                </li>
                <li>Verifikasi keaslian aplikasi via Firebase App Check</li>
                <li>Token autentikasi dengan masa berlaku terbatas</li>
                <li>Akses data dibatasi berdasarkan role karyawan (RBAC)</li>
                <li>Audit log untuk akses data sensitif</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                7. Hak Anda sebagai Pengguna
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
                Sebagai pengguna RADPRO, Anda memiliki hak untuk:
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                <li>
                  <strong>Akses:</strong> meminta salinan data pribadi yang kami
                  simpan
                </li>
                <li>
                  <strong>Koreksi:</strong> memperbarui data yang tidak akurat
                </li>
                <li>
                  <strong>Penghapusan:</strong> meminta penghapusan akun dan
                  data
                </li>
                <li>
                  <strong>Pembatasan:</strong> meminta pembatasan pemrosesan
                  data tertentu
                </li>
                <li>
                  <strong>Portabilitas:</strong> meminta data dalam format yang
                  dapat dipindahkan
                </li>
                <li>
                  <strong>Penolakan:</strong> menolak pemrosesan data untuk
                  tujuan tertentu
                </li>
              </ol>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Untuk mengajukan permintaan, hubungi{" "}
                <a
                  href="mailto:admin@radpro.id"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  admin@radpro.id
                </a>
                .
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                8. Penghapusan Akun dan Data
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
                Anda dapat meminta penghapusan akun dengan dua cara:
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                <li>
                  <strong>Via aplikasi:</strong> Profil &rarr; Pengaturan &rarr;
                  Hapus Akun
                </li>
                <li>
                  <strong>Via email:</strong> kirim ke{" "}
                  <a
                    href="mailto:admin@radpro.id"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    admin@radpro.id
                  </a>{" "}
                  dengan subjek &quot;Permintaan Penghapusan Akun&quot;
                </li>
              </ol>
              <p className="text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
                Setelah permintaan diterima:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                <li>Akun dinonaktifkan dalam 24 jam</li>
                <li>Data pribadi non-wajib dihapus dalam 7 hari kerja</li>
                <li>
                  Data yang harus disimpan untuk kepatuhan hukum (payroll,
                  audit) dianonimkan dan disimpan sesuai periode retensi di
                  bagian 5
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                9. Anak di Bawah Umur
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                RADPRO adalah aplikasi internal perusahaan dan{" "}
                <strong>
                  tidak ditujukan untuk pengguna di bawah usia 18 tahun
                </strong>
                . Kami tidak secara sadar mengumpulkan data dari anak-anak di
                bawah umur. Bila Anda menemukan data anak di bawah umur yang
                terkumpul, mohon hubungi kami untuk dihapus.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                10. Perubahan Kebijakan
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
                Kami dapat memperbarui Kebijakan Privasi ini sewaktu-waktu.
                Perubahan signifikan akan diberitahukan melalui:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                <li>Notifikasi dalam Aplikasi</li>
                <li>Email ke alamat terdaftar Anda</li>
                <li>
                  Pembaruan tanggal &quot;Berlaku efektif&quot; di bagian atas
                  halaman ini
                </li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Penggunaan Aplikasi yang berkelanjutan setelah perubahan
                dianggap sebagai persetujuan terhadap kebijakan baru.
              </p>
            </section>

            <section>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
                11. Hubungi Kami
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Jika Anda memiliki pertanyaan, keluhan, atau permintaan terkait
                Kebijakan Privasi ini:
              </p>
              <ul className="list-none pl-0 space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed mt-3">
                <li>
                  <strong>Email:</strong>{" "}
                  <a
                    href="mailto:admin@radpro.id"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    admin@radpro.id
                  </a>
                </li>
                <li>
                  <strong>Website:</strong>{" "}
                  <a
                    href="https://radpro.id"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    https://radpro.id
                  </a>
                </li>
                <li>
                  <strong>Pengembang:</strong> RADPRO
                </li>
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
