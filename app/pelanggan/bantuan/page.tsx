"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiOutlineQuestionMarkCircle,
  HiOutlinePhone,
  HiOutlineEnvelope,
  HiOutlineChatBubbleLeftRight,
  HiChevronRight,
  HiTicket,
  HiPlus,
} from 'react-icons/hi2'
import Link from 'next/link'
import PelangganHeader from '@/components/pelanggan/PelangganHeader'

type FAQItem = {
  id: string
  question: string
  answer: string
}

export default function BantuanPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null)

  const faqList: FAQItem[] = [
    {
      id: '1',
      question: 'Bagaimana cara melakukan pembayaran tagihan?',
      answer:
        'Anda dapat melakukan pembayaran melalui portal pelanggan ini dengan klik "Bayar Tagihan" di dashboard atau menu Tagihan. Pilih metode pembayaran (Xendit/Midtrans), dan ikuti instruksi pembayaran. Setelah pembayaran, tagihan akan otomatis terupdate.',
    },
    {
      id: '2',
      question: 'Apa yang harus dilakukan jika internet terputus?',
      answer:
        'Jika internet terputus, silakan cek terlebih dahulu koneksi kabel dan pastikan router dalam kondisi menyala. Cek juga apakah ada tagihan yang belum dibayar. Jika masalah masih berlanjut, hubungi customer service kami.',
    },
    {
      id: '3',
      question: 'Bagaimana cara mengubah password PPPoE?',
      answer:
        'Untuk mengubah password PPPoE, silakan hubungi customer service kami dengan menyertakan ID Pelanggan dan verifikasi identitas. Proses perubahan password akan dilakukan dalam 1x24 jam.',
    },
    {
      id: '4',
      question: 'Bagaimana cara upgrade paket internet?',
      answer:
        'Anda dapat mengajukan upgrade paket dengan menghubungi customer service kami. Proses upgrade biasanya memakan waktu 1-3 hari kerja tergantung ketersediaan slot.',
    },
    {
      id: '5',
      question: 'Apa perbedaan Password Login Portal dan Password PPPoE?',
      answer:
        'Password Login Portal digunakan untuk masuk ke portal pelanggan ini, sedangkan Password PPPoE digunakan untuk koneksi internet di router Anda. Kedua password ini berbeda dan terpisah.',
    },
    {
      id: '6',
      question: 'Bagaimana cara lupa ID Pelanggan atau password?',
      answer:
        'Jika Anda lupa ID Pelanggan atau password, silakan hubungi customer service kami dengan menyertakan data identitas untuk proses reset.',
    },
  ]

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('pelanggan_token')
      const pelangganData = localStorage.getItem('pelanggan_data')

      if (!token || !pelangganData) {
        router.push('/pelanggan/login')
        return
      }

      setLoading(false)
    }

    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Memuat data...</div>
      </div>
    )
  }

  return (
    <>
      {/* Main Content Container */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <PelangganHeader title="Bantuan & FAQ" subtitle="Pusat bantuan dan pertanyaan umum" />

        {/* Content */}
        <main className="px-4 py-6 md:px-6 lg:px-8 max-w-5xl mx-auto">
          {/* Ticket System Section */}
          <div className="bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl shadow-lg p-6 mb-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <HiTicket className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Sistem Tiket Bantuan</h2>
                <p className="text-sm text-sky-100">Ajukan dan lacak pertanyaan Anda</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/pelanggan/bantuan/tiket/buat"
                className="bg-white text-sky-600 rounded-lg p-4 flex flex-col items-center justify-center gap-2 hover:bg-sky-50 transition-colors active:scale-[0.98]"
              >
                <HiPlus className="w-6 h-6" />
                <span className="text-sm font-semibold">Buat Tiket</span>
              </Link>
              <Link
                href="/pelanggan/bantuan/tiket"
                className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-4 flex flex-col items-center justify-center gap-2 hover:bg-white/20 transition-colors active:scale-[0.98]"
              >
                <HiTicket className="w-6 h-6" />
                <span className="text-sm font-semibold">Lihat Tiket</span>
              </Link>
            </div>
          </div>

          {/* Contact Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-5 text-center transition-transform hover:scale-105">
              <div className="w-14 h-14 bg-gradient-to-br from-sky-400 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <HiOutlinePhone className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Telepon</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">0812-3456-7890</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Senin - Jumat: 08:00 - 17:00</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-5 text-center transition-transform hover:scale-105">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <HiOutlineChatBubbleLeftRight className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">WhatsApp</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">0812-3456-7890</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">24/7 Available</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-5 text-center transition-transform hover:scale-105">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <HiOutlineEnvelope className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Email</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 break-all">support@netmanager.com</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Response dalam 24 jam</p>
            </div>
          </div>

          {/* Note */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-400">
              <strong>Catatan:</strong> Untuk informasi kontak customer service yang aktual, silakan hubungi administrator Anda.
            </p>
          </div>

          {/* FAQ Section */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/20 rounded-lg flex items-center justify-center">
                <HiOutlineQuestionMarkCircle className="w-6 h-6 text-sky-600 dark:text-sky-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Pertanyaan Umum (FAQ)</h2>
            </div>
            <div className="space-y-3">
              {faqList.map((faq) => (
                <div
                  key={faq.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all hover:border-sky-300 dark:hover:border-sky-700"
                >
                  <button
                    onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <span className="flex-1 font-medium text-gray-900 dark:text-white pr-4 text-sm">{faq.question}</span>
                    <HiChevronRight
                      className={`w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${expandedFAQ === faq.id ? 'rotate-90' : ''
                        }`}
                    />
                  </button>
                  {expandedFAQ === faq.id && (
                    <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-gray-800">
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-3">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
