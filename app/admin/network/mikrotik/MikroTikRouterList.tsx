"use client"
import { useState } from 'react'

import { toast } from 'react-hot-toast'

import ReconfigureModal from '@/components/mikrotik/ReconfigureModal'
import TestConnectionModal from '@/components/mikrotik/TestConnectionModal'
import { MikrotikRouterTable } from '@/app/admin/network/mikrotik/components/mikrotikRouterTable'
import { useMikrotikRouterList } from '@/app/admin/network/mikrotik/hooks/useMikrotikRouterList'
import type { MikrotikTestConnectionResult } from '@/app/admin/network/mikrotik/mikrotikFormShared'

export default function MikroTikRouterList() {
  const {
    data,
    loading,
    search,
    setSearch,
    page,
    setPage,
    limit,
    setLimit,
    pppConnectionMode,
    refresh,
  } = useMikrotikRouterList()

  const [showTestModal, setShowTestModal] = useState(false)
  const [showReconfigureModal, setShowReconfigureModal] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<MikrotikTestConnectionResult | null>(null)

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus router "${name}"?`)) {
      return
    }

    try {
      const res = await fetch(`/api/mikrotik-routers/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || 'Gagal menghapus router')
        return
      }

      toast.success('Router berhasil dihapus')
      await refresh()
    } catch (_error) {
      toast.error('Gagal menghapus router')
    }
  }

  const handleTestConnection = async (id: string) => {
    setIsTesting(true)
    setShowTestModal(true)
    setTestResult(null)

    try {
      const res = await fetch('/api/mikrotik-routers/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routerId: id }),
      })

      const result = await res.json()
      setTestResult(result)

      if (res.ok && result.success) {
        await refresh()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
      console.error('Test connection error:', error)
      setTestResult({
        success: false,
        api: { success: false, message: 'Error: ' + errorMessage },
        message: 'Terjadi kesalahan saat test koneksi',
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="space-y-5">
      <MikrotikRouterTable
        routers={data.routers}
        total={data.total}
        totalPages={data.totalPages}
        page={page}
        limit={limit}
        loading={loading}
        search={search}
        pppConnectionMode={pppConnectionMode}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        onLimitChange={(value) => {
          setLimit(value)
          setPage(1)
        }}
        onPrevPage={() => setPage((prev) => Math.max(1, prev - 1))}
        onNextPage={() => setPage((prev) => Math.min(data.totalPages, prev + 1))}
        onOpenReconfigure={() => setShowReconfigureModal(true)}
        onTestConnection={(id) => {
          void handleTestConnection(id)
        }}
        onDelete={(id, name) => {
          void handleDelete(id, name)
        }}
      />

      <TestConnectionModal
        open={showTestModal}
        onClose={() => setShowTestModal(false)}
        result={testResult}
        isLoading={isTesting}
      />

      <ReconfigureModal
        open={showReconfigureModal}
        onClose={() => setShowReconfigureModal(false)}
        onSuccess={() => {
          setShowReconfigureModal(false)
          void refresh()
        }}
      />
    </div>
  )
}
