import Link from 'next/link'
import { 
  HiOutlineServer, 
  HiOutlineSignal, 
  HiOutlineGlobeAlt,
  HiOutlineChartBar,
  HiOutlineShieldCheck,
  HiOutlineCog6Tooth,
  HiOutlineArrowRight
} from 'react-icons/hi2'

export default function HomePage() {
  const features = [
    {
      icon: <HiOutlineServer className="w-8 h-8" />,
      title: 'Network Management',
      description: 'Kelola router MikroTik, OLT, dan ONU dengan mudah melalui antarmuka yang intuitif',
    },
    {
      icon: <HiOutlineGlobeAlt className="w-8 h-8" />,
      title: 'FTTH Infrastructure',
      description: 'Manajemen lengkap infrastruktur FTTH termasuk ODC, ODP, OTB, dan Pole',
    },
    {
      icon: <HiOutlineChartBar className="w-8 h-8" />,
      title: 'Real-time Monitoring',
      description: 'Pantau status jaringan dan perangkat secara real-time dengan dashboard yang informatif',
    },
    {
      icon: <HiOutlineSignal className="w-8 h-8" />,
      title: 'Speed Profiles',
      description: 'Kelola profil kecepatan internet dan konfigurasi VLAN dengan efisien',
    },
    {
      icon: <HiOutlineShieldCheck className="w-8 h-8" />,
      title: 'User Management',
      description: 'Sistem manajemen pengguna dengan kontrol akses yang terintegrasi',
    },
    {
      icon: <HiOutlineCog6Tooth className="w-8 h-8" />,
      title: 'Automated Sync',
      description: 'Sinkronisasi otomatis data perangkat jaringan dengan jadwal yang dapat dikonfigurasi',
    },
  ]

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900">
      {/* Navigation */}
      <nav className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">NetManager</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Masuk
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md"
              >
                Mulai Sekarang
                <HiOutlineArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 sm:pt-24 sm:pb-20">
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
              Kelola Jaringan Anda
              <span className="block text-indigo-600 dark:text-indigo-400">Dengan Mudah</span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed">
              Platform manajemen jaringan terintegrasi untuk mengelola infrastruktur FTTH, 
              perangkat jaringan, dan monitoring real-time dalam satu tempat
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-xl hover:scale-105"
              >
                Mulai Menggunakan
                <HiOutlineArrowRight className="w-5 h-5" />
              </Link>
              <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-gray-800 px-8 py-4 text-base font-semibold text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-700 shadow-sm transition-all hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600">
                Pelajari Lebih Lanjut
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 sm:py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Fitur Utama
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Semua yang Anda butuhkan untuk mengelola infrastruktur jaringan FTTH secara efisien
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative p-8 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-24 bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-700 dark:to-blue-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Siap Memulai?
          </h2>
          <p className="text-xl text-indigo-100 mb-10 max-w-2xl mx-auto">
            Bergabunglah dengan NetManager hari ini dan rasakan kemudahan dalam mengelola infrastruktur jaringan Anda
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-indigo-600 shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl hover:scale-105"
          >
            Masuk ke Dashboard
            <HiOutlineArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">NetManager</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              © {new Date().getFullYear()} NetManager. Platform manajemen jaringan terintegrasi.
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}


