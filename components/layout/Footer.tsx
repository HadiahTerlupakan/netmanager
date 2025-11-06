export default function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <p>© {new Date().getFullYear()} NetManager</p>
        <p className="hidden sm:inline text-xs">Next.js & Tailwind CSS</p>
      </div>
    </footer>
  )
}


