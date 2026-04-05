"use client"

import { useEffect, useState } from 'react'

import { Modal } from '@/components/ui/Modal'

import { BandwidthDetailContent } from '@/app/admin/paket/bandwidth/components/BandwidthDetailContent'
import type { BandwidthDetail } from '@/app/admin/paket/bandwidth/lib/bandwidthTypes'

type BandwidthDetailModalProps = {
  open: boolean
  onClose: () => void
  bandwidthId: string | null
}

export default function BandwidthDetailModal({ open, onClose, bandwidthId }: BandwidthDetailModalProps) {
  const [bandwidth, setBandwidth] = useState<BandwidthDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && bandwidthId) {
      void loadDetail(bandwidthId)
    } else {
      setBandwidth(null)
      setError(null)
    }
  }, [open, bandwidthId])

  const loadDetail = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bandwidths/${id}`)
      if (!res.ok) throw new Error('Gagal memuat detail bandwidth')
      const result = await res.json()
      setBandwidth(result.data || result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Detail Bandwidth"
      size="2xl"
    >
      <BandwidthDetailContent
        bandwidth={bandwidth}
        loading={loading}
        error={error}
      />
    </Modal>
  )
}
