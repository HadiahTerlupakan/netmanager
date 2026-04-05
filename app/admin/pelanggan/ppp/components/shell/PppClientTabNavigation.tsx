type PppClientTab = 'paket' | 'info'

type PppClientTabNavigationProps = {
  activeTab: PppClientTab
  onTabChange: (tab: PppClientTab) => void
}

export function PppClientTabNavigation({ activeTab, onTabChange }: PppClientTabNavigationProps) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <nav className="flex space-x-8" aria-label="Tabs">
        <button
          type="button"
          onClick={() => onTabChange('paket')}
          className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'paket'
            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
        >
          Paket Langganan
        </button>
        <button
          type="button"
          onClick={() => onTabChange('info')}
          className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'info'
            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
        >
          Info Pelanggan
        </button>
      </nav>
    </div>
  )
}
