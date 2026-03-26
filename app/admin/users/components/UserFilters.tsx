import { HiMagnifyingGlass, HiOutlineFunnel } from 'react-icons/hi2'

interface UserFiltersProps {
    searchTerm: string
    setSearchTerm: (term: string) => void
    statusFilter: 'all' | 'active' | 'inactive'
    setStatusFilter: (status: 'all' | 'active' | 'inactive') => void
}

export default function UserFilters({ 
    searchTerm, 
    setSearchTerm, 
    statusFilter, 
    setStatusFilter 
}: UserFiltersProps) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex flex-col md:flex-row gap-4">
                {/* Search Input */}
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <HiMagnifyingGlass className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Cari pengguna berdasarkan email, nama, telepon, atau departemen..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>
                {/* Status Filter */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <HiOutlineFunnel className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                        className="pl-10 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                        <option value="all">Semua Status</option>
                        <option value="active">Aktif</option>
                        <option value="inactive">Nonaktif</option>
                    </select>
                </div>
            </div>
        </div>
    )
}
