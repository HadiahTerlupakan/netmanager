"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiOutlineQuestionMarkCircle,
  HiOutlinePhone,
  HiOutlineEnvelope,
  HiOutlineChatBubbleLeftRight,
  HiArrowLeft,
  HiOutlineHome,
  HiOutlineCreditCard,
  HiOutlineUser,
  HiOutlineInformationCircle,
  HiChevronRight,
  HiBell,
  HiOutlineDocumentText,
} from 'react-icons/hi2'
import Link from 'next/link'

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
        'Anda dapat melakukan pembayaran melalui transfer bank ke rekening yang tertera di tagihan, atau datang langsung ke kantor kami. Setelah pembayaran, tagihan akan otomatis terupdate dalam 1x24 jam.',
    },
    {
      id: '2',
      question: 'Apa yang harus dilakukan jika internet terputus?',
      answer:
        'Jika internet terputus, silakan cek terlebih dahulu koneksi kabel dan pastikan router dalam kondisi menyala. Jika masalah masih berlanjut, hubungi customer service kami untuk bantuan lebih lanjut.',
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Memuat data...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      {/* Sky Blue Header - Mobile App Style */}
      <header className="bg-gradient-to-r from-sky-400 to-cyan-500 text-white shadow-lg">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/pelanggan"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
              >
                <HiArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold">Bantuan & FAQ</h1>
            </div>
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation">
              <HiBell className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4">
        {/* Contact Cards */}
        <div className="grid grid-cols-1 gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-5 text-center active:scale-[0.98] transition-transform touch-manipulation">
            <div className="w-14 h-14 bg-gradient-to-br from-sky-400 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <HiOutlinePhone className="w-7 h-7 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Telepon</h3>
            <p className="text-sm text-gray-600">0812-3456-7890</p>
            <p className="text-xs text-gray-500 mt-1">Senin - Jumat: 08:00 - 17:00</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 text-center active:scale-[0.98] transition-transform touch-manipulation">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <HiOutlineChatBubbleLeftRight className="w-7 h-7 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">WhatsApp</h3>
            <p className="text-sm text-gray-600">0812-3456-7890</p>
            <p className="text-xs text-gray-500 mt-1">24/7 Available</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 text-center active:scale-[0.98] transition-transform touch-manipulation">
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <HiOutlineEnvelope className="w-7 h-7 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
            <p className="text-sm text-gray-600 break-all">support@netmanager.com</p>
            <p className="text-xs text-gray-500 mt-1">Response dalam 24 jam</p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
              <HiOutlineQuestionMarkCircle className="w-6 h-6 text-sky-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Pertanyaan Umum (FAQ)</h2>
          </div>
          <div className="space-y-2">
            {faqList.map((faq) => (
              <div
                key={faq.id}
                className="border border-gray-200 rounded-lg overflow-hidden active:scale-[0.98] transition-transform touch-manipulation"
              >
                <button
                  onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="flex-1 font-medium text-gray-900 pr-4 text-sm">{faq.question}</span>
                  <HiChevronRight
                    className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${expandedFAQ === faq.id ? 'rotate-90' : ''
                      }`}
                  />
                </button>
                {expandedFAQ === faq.id && (
                  <div className="px-4 pb-4 pt-0">
                    <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Navigation - Mobile App Style */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg md:hidden">
        <div className="flex items-center justify-around h-16">
          <Link
            href="/pelanggan"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
          >
            <HiOutlineHome className="w-6 h-6" />
            <span className="text-xs font-medium">Beranda</span>
          </Link>
          <Link
            href="/pelanggan/tagihan"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
          >
            <HiOutlineDocumentText className="w-6 h-6" />
            <span className="text-xs font-medium">Tagihan</span>
          </Link>
          <Link
            href="/pelanggan/profil"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
          >
            <HiOutlineUser className="w-6 h-6" />
            <span className="text-xs font-medium">Profil</span>
          </Link>
          <Link
            href="/pelanggan/bantuan"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-sky-500 touch-manipulation"
          >
            <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center">
              <HiOutlineInformationCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Bantuan</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
