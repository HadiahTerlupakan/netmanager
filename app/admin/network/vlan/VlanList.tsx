"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiArrowPath, HiPencil, HiTrash } from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'

type Olt = { id: string; name: string; ipAddress: string }
type Vlan = {
  vlanId: number
  name: string
  description: string
  ports: string[]
}

export default function VlanPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [olts, setOlts] = useState<Olt[]>([])
  const [selectedOltId, setSelectedOltId] = useState<string>('')
  const [selectedOlt, setSelectedOlt] = useState<Olt | null>(null)
  const [vlans, setVlans] = useState<Vlan[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const [editingVlan, setEditingVlan] = useState<Vlan | null>(null)
  const [deleteVlanId, setDeleteVlanId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Load OLTs
  useEffect(() => {
    ; (async () => {
      try {
        const res = await fetch('/api/olts')
        if (!res.ok) throw new Error('Gagal memuat data OLT')
        const j = await res.json()
        const rows = (j?.olts || []).map((o: any) => ({ id: o.id, name: o.name, ipAddress: o.ipAddress }))
        setOlts(rows)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const loadVlans = async (oltIdToLoad: string) => {
    setRefreshing(true)
    setError(null)
    setWarning(null)
    try {
      const res = await fetch(`/api/olts/${oltIdToLoad}/vlans`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Gagal memuat data VLAN' }))
        throw new Error(errorData.error || 'Gagal memuat data VLAN')
      }
      const data = await res.json()
      setVlans(data.vlans || [])
      if (data.warning) {
        setWarning(data.warning)
      }
    } catch (e: any) {
      setError(e.message)
      setVlans([])
      setWarning(null)
    } finally {
      setRefreshing(false)
    }
  }

  const handleOltChange = (oltId: string) => {
    const olt = olts.find((o) => o.id === oltId)
    if (olt) {
      setSelectedOlt(olt)
      setSelectedOltId(olt.id)
      loadVlans(olt.id)
    } else {
      setSelectedOlt(null)
      setVlans([])
    }
  }

  const handleRefresh = () => {
    if (selectedOlt) {
      loadVlans(selectedOlt.id)
    }
  }

  const handleEdit = (vlan: Vlan) => {
    setEditingVlan(vlan)
  }

  const handleDelete = async (vlanId: number) => {
    if (!selectedOlt) return

    if (!confirm(`Apakah Anda yakin ingin menghapus VLAN ${vlanId}?`)) {
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/olts/${selectedOlt.id}/vlans?vlanId=${vlanId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Gagal menghapus VLAN' }))
        throw new Error(errorData.error || 'Gagal menghapus VLAN')
      }

      // Reload VLAN list
      await loadVlans(selectedOlt.id)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsDeleting(false)
      setDeleteVlanId(null)
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedOlt || !editingVlan) return

    setIsEditing(true)
    setError(null)

    try {
      const res = await fetch(`/api/olts/${selectedOlt.id}/vlans`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vlanId: editingVlan.vlanId,
          name: editingVlan.name,
          description: editingVlan.description,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Gagal mengedit VLAN' }))
        throw new Error(errorData.error || 'Gagal mengedit VLAN')
      }

      // Reload VLAN list
      await loadVlans(selectedOlt.id)
      setEditingVlan(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsEditing(false)
    }
  }

  // Define columns for ResponsiveTable
  const columns: Column<Vlan>[] = [
    {
      key: 'vlanId',
      header: 'ID',
      priority: 'primary',
      render: (vlan) => (
        <span className="text-sm font-medium text-gray-900 dark:text-white">{vlan.vlanId}</span>
      )
    },
    {
      key: 'name',
      header: 'Name',
      priority: 'primary',
      render: (vlan) => (
        <span className="text-sm text-gray-900 dark:text-white">{vlan.name}</span>
      )
    },
    {
      key: 'description',
      header: 'Description',
      priority: 'secondary',
      render: (vlan) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{vlan.description || '-'}</span>
      )
    }
  ]

  // Render actions for each row
  const renderActions = (vlan: Vlan) => (
    <>
      <button
        onClick={() => handleEdit(vlan)}
        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors"
        title="Edit VLAN"
      >
        <HiPencil className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleDelete(vlan.vlanId)}
        disabled={isDeleting}
        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
        title="Delete VLAN"
      >
        <HiTrash className="w-4 h-4" />
      </button>
    </>
  )

  if (loading) {
    return <PageLoader />
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span>Home</span> <span className="mx-2">/</span> <span className="text-gray-900 dark:text-white">VLAN</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">VLAN</h1>
        {selectedOlt && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60"
          >
            <HiArrowPath className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      {/* OLT Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <label className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 block">Pilih OLT</label>
        <select
          value={selectedOltId}
          onChange={(e) => handleOltChange(e.target.value)}
          className="w-full max-w-md rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
        >
          <option value="">-- Pilih OLT --</option>
          {olts.map((olt) => (
            <option key={olt.id} value={olt.id}>
              {olt.name} ({olt.ipAddress})
            </option>
          ))}
        </select>
      </div>

      {/* VLAN Table */}
      {selectedOlt && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-2">{error}</p>
              {error.includes('SNMP tidak connected') && (
                <div className="mt-2 text-xs text-red-500 dark:text-red-400">
                  <p>Solusi:</p>
                  <ol className="list-decimal list-inside space-y-1 mt-1">
                    <li>Kembali ke halaman OLT Management</li>
                    <li>Klik tombol Edit pada OLT yang baru ditambahkan</li>
                    <li>Klik tombol &quot;Test Connection&quot; untuk menguji koneksi SNMP</li>
                    <li>Setelah test berhasil, kembali ke halaman ini dan refresh</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {warning && !error && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">{warning}</p>
            </div>
          )}

          {vlans.length > 0 && (
            <>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  VLAN List ({vlans.length} VLANs)
                </h2>
              </div>
              <ResponsiveTable
                data={vlans}
                columns={columns}
                keyField="vlanId"
                loading={refreshing}
                emptyMessage="Tidak ada data VLAN ditemukan"
                loadingMessage="Memuat data..."
                renderActions={renderActions}
              />
            </>
          )}

          {!error && vlans.length === 0 && !refreshing && (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada data VLAN ditemukan</p>
            </div>
          )}
        </div>
      )}

      {!selectedOlt && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pilih OLT terlebih dahulu untuk melihat data VLAN</p>
        </div>
      )}

      {/* Edit Modal */}
      {editingVlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Edit VLAN {editingVlan.vlanId}</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editingVlan.name}
                    onChange={(e) => setEditingVlan({ ...editingVlan, name: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={editingVlan.description || ''}
                    onChange={(e) => setEditingVlan({ ...editingVlan, description: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setEditingVlan(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isEditing}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isEditing ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
