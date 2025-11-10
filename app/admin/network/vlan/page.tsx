"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiArrowPath } from 'react-icons/hi2'

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

  // Load OLTs
  useEffect(() => {
    ;(async () => {
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
    try {
      const res = await fetch(`/api/olts/${oltIdToLoad}/vlans`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Gagal memuat data VLAN' }))
        throw new Error(errorData.error || 'Gagal memuat data VLAN')
      }
      const data = await res.json()
      setVlans(data.vlans || [])
    } catch (e: any) {
      setError(e.message)
      setVlans([])
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Memuat data...</p>
        </div>
      </div>
    )
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
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {!error && vlans.length === 0 && !refreshing && (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada data VLAN ditemukan</p>
            </div>
          )}

          {vlans.length > 0 && (
            <>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  VLAN List ({vlans.length} VLANs)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Ports
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                    {vlans.map((vlan) => (
                      <tr key={vlan.vlanId} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{vlan.vlanId}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900 dark:text-white">{vlan.name}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {vlan.description || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {vlan.ports.length > 0 ? (
                              vlan.ports.map((port, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                >
                                  {port}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {!selectedOlt && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pilih OLT terlebih dahulu untuk melihat data VLAN</p>
        </div>
      )}
    </div>
  )
}

