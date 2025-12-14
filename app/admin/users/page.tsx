'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { HiOutlinePlus, HiOutlineBriefcase, HiOutlineUserCircle, HiMagnifyingGlass, HiOutlineUserGroup, HiOutlineUsers, HiOutlineBuildingOffice, HiOutlineEye } from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'

interface User {
  id: string
  email: string
  name: string | null
  createdAt: string
  employee: {
    id: string
    employeeId: string
    department: { id: string; name: string } | null
    position: { id: string; title: string } | null
    employmentStatus: string
  } | null
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // const [filter, setFilter] = useState<'ALL' | 'EMPLOYEE' | 'SYSTEM'>('ALL') // Removed filter state
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/users')
      const data = await res.json()
      if (res.ok) {
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user => {
    // const matchesFilter = filter === 'ALL' || ... // Removed filter logic

    const matchesSearch = searchTerm === '' ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employee?.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employee?.department?.name?.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  // Statistics for cards
  const totalUsers = users.length
  // Stats for cards removed

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Pengguna</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Kelola pengguna sistem dan data karyawan
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Tambah Pengguna
        </Link>
      </div>

      {/* Stats Cards */}
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <HiOutlineUsers className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Pengguna</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <HiMagnifyingGlass className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cari pengguna berdasarkan email, nama, ID pegawai, atau departemen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

      </div>


      {/* Users List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <PageLoader variant="section" message="Memuat data pengguna..." />
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <HiOutlineUsers className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Tidak ada pengguna ditemukan</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchTerm ? 'Coba ubah kata kunci pencarian Anda' : 'Mulai dengan menambahkan pengguna baru'}
            </p>
            <Link
              href="/admin/users/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <HiOutlinePlus className="w-5 h-5" />
              Tambah Pengguna
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Pengguna
                  </th>
                  {/* Role column removed */}
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    ID Pegawai
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Departemen
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Dibuat
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                          {user.employee ? (
                            <HiOutlineBriefcase className="w-5 h-5 text-white" />
                          ) : (
                            <HiOutlineUserCircle className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.name || user.email.split('@')[0]}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    {/* Role column removed */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {user.employee?.employeeId || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {user.employee?.department?.name ? (
                        <span className="inline-flex items-center gap-1.5">
                          <HiOutlineBuildingOffice className="w-3.5 h-3.5 text-gray-400" />
                          {user.employee.department.name}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/admin/users/${user.id}?view=true`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                        title="Lihat Detail"
                      >
                        <HiOutlineEye className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div >
  )
}
