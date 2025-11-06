import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-dvh grid place-items-center p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-950 dark:to-zinc-900">
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-3">NetManager</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">Next.js + Tailwind CSS</p>
        </div>
        <Link 
          href="/login"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-gray-800 hover:shadow-xl dark:bg-white dark:text-black dark:hover:bg-gray-100"
        >
          <span>🚀</span>
          Mulai
        </Link>
      </div>
    </main>
  )
}


