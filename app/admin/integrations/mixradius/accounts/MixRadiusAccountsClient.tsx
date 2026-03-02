
'use client'

import { useState, useEffect } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiMagnifyingGlass, HiOutlineServer, HiOutlineCheckCircle } from 'react-icons/hi2'
import { Modal } from '@/components/ui/Modal'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'

interface MixRadiusConfig {
  id: string
  name: string
  baseUrl: string
  username: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function MixRadiusAccountsClient() {
  const { hasPermission } = usePermission()

  // Permission checks
  const canCreate = hasPermission('mixradius_accounts:create')
  const canUpdate = hasPermission('mixradius_accounts:update')
  const canDelete = hasPermission('mixradius_accounts:delete')

  // Debugging (Remove later)
  // console.log('Permissions:', { canCreate, canUpdate, canDelete, all: hasPermission('mixradius_accounts:create') })

  const [configs, setConfigs] = useState<MixRadiusConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    baseUrl: 'https://',
    username: '',
    password: '',
    isActive: false
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/integrations/mixradius/accounts')
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Gagal mengambil daftar akun')
      }
      const data = await res.json()
      // Handle both { data: [...] } and direct array response
      const rawConfigs = Array.isArray(data) ? data : (data.data || [])

      // Map API fields (apiUrl) to UI fields (baseUrl)
      const mapped = rawConfigs.map((c: Partial<MixRadiusConfig> & { apiUrl?: string }) => ({
        ...c,
        baseUrl: c.baseUrl || c.apiUrl || '',
        name: c.name || 'Default Account'
      }))
      setConfigs(mapped)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengambil daftar akun')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.baseUrl.trim() || !formData.username.trim()) {
      const missing: string[] = []
      if (!formData.name.trim()) missing.push('Nama Akun')
      if (!formData.baseUrl.trim()) missing.push('Base URL')
      if (!formData.username.trim()) missing.push('Username')
      toast.error(`Kolom berikut wajib diisi: ${missing.join(', ')}`)
      return
    }

    if (!editingId && !formData.password.trim()) {
      toast.error('Password wajib diisi untuk akun baru')
      return
    }

    // Basic URL validation
    if (!formData.baseUrl.startsWith('http')) {
      toast.error('URL harus dimulai dengan http:// atau https://')
      return
    }

    try {
      const url = editingId
        ? `/api/integrations/mixradius/accounts/${editingId}`
        : '/api/integrations/mixradius/accounts'

      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal menyimpan akun')
      }

      toast.success(editingId ? 'Akun berhasil diperbarui' : 'Akun berhasil ditambahkan')
      setIsModalOpen(false)
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan akun')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus akun "${name}"? Data yang sudah ada mungkin tidak bisa diakses jika akun dihapus.`)) return

    try {
      const res = await fetch(`/api/integrations/mixradius/accounts/${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Gagal menghapus akun')
      }

      toast.success('Akun berhasil dihapus')
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus akun')
    }
  }

  const handleActivate = async (id: string, name: string) => {
    // Optimistic update
    const previousConfigs = [...configs];
    setConfigs(prev => prev.map(c => ({ ...c, isActive: c.id === id })));

    try {
      // We can use PUT to set isActive=true. The backend logic handles deactivating others.
      const res = await fetch(`/api/integrations/mixradius/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Gagal mengaktifkan akun')
      }
      toast.success(`Akun "${name}" diaktifkan`);
      fetchData(); // Refresh to ensure sync
    } catch (error) {
      setConfigs(previousConfigs); // Revert on error
      toast.error(error instanceof Error ? error.message : 'Gagal mengaktifkan akun');
    }
  }

  const openEdit = (config: MixRadiusConfig) => {
    setEditingId(config.id)
    setFormData({
      name: config.name,
      baseUrl: config.baseUrl,
      username: config.username,
      password: '', // Don't show password
      isActive: config.isActive
    })
    setIsModalOpen(true)
  }

  const openCreate = () => {
    setEditingId(null)
    setFormData({
      name: '',
      baseUrl: 'https://',
      username: '',
      password: '',
      isActive: false
    })
    setIsModalOpen(true)
  }

  const columns: Column<MixRadiusConfig>[] = [
    {
      header: 'Nama Akun',
      key: 'name',
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900 dark:text-white">{item.name}</span>
          <span className="text-xs text-gray-500">{item.baseUrl}</span>
        </div>
      )
    },
    {
      header: 'Username',
      key: 'username',
    },
    {
      header: 'Status',
      key: 'isActive',
      render: (item) => item.isActive
        ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
          <HiOutlineCheckCircle className="mr-1" /> Aktif
        </span>
        : <span className="text-gray-500 text-sm">Tidak Aktif</span>
    },
    ...((canUpdate || canDelete) ? [{
      header: 'Aksi',
      key: 'id',
      render: (item: MixRadiusConfig) => (
        <div className="flex gap-2 items-center">
          {!item.isActive && canUpdate && (
            <button
              onClick={() => handleActivate(item.id, item.name)}
              className="px-2 py-1 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 transition"
              title="Aktifkan Akun Ini"
            >
              Aktifkan
            </button>
          )}
          {canUpdate && (
            <button
              onClick={() => openEdit(item)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg dark:text-blue-400 dark:hover:bg-blue-900/30"
              title="Edit"
            >
              <HiOutlinePencil className="text-lg" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => handleDelete(item.id, item.name)}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg dark:text-red-400 dark:hover:bg-red-900/30"
              title="Hapus"
            >
              <HiOutlineTrash className="text-lg" />
            </button>
          )}
        </div>
      )
    }] : [])
  ]

  const filteredConfigs = configs.filter(c =>
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.baseUrl || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-6">
      <Toaster />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineServer className="text-blue-600" />
            Akun MixRadius
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kelola multiple akun/server MixRadius. Pilih satu akun sebagai yang <strong>Aktif</strong>.
          </p>
        </div>

        {canCreate && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <HiOutlinePlus className="text-xl" />
            Tambah Akun
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-[#1c2936] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative max-w-md">
            <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              placeholder="Cari Akun..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <ResponsiveTable
          data={filteredConfigs}
          columns={columns}
          keyField="id"
          loading={loading}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Akun' : 'Tambah Akun Baru'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Akun (Label)
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Server Jakarta"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Base URL MixRadius
            </label>
            <input
              type="url"
              required
              placeholder="https://ip-or-domain:port"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              value={formData.baseUrl}
              onChange={e => setFormData({ ...formData, baseUrl: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">Sertakan protokol (http/https) dan port.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username
            </label>
            <input
              type="text"
              required
              autoComplete="off"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password {editingId && '(Biarkan kosong jika tidak diubah)'}
            </label>
            <input
              type="password"
              required={!editingId}
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActiveAccount"
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              checked={formData.isActive}
              onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
            />
            <label htmlFor="isActiveAccount" className="text-sm text-gray-700 dark:text-gray-300">
              Set sebagai Akun Aktif
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
