"use client"

import { useEffect, useState } from 'react'

import { Modal } from '@/components/ui/Modal'

import { HargaDetailContent } from '@/app/admin/paket/harga/components/HargaDetailContent'
import type { HargaPaketDetail } from '@/app/admin/paket/harga/lib/hargaTypes'

type HargaPaketDetailModalProps = {
  open: boolean
  onClose: () => void
  paketId: string | null
}

export default function HargaPaketDetailModal({ open, onClose, paketId }: HargaPaketDetailModalProps) {
  const [paket, setPaket] = useState<HargaPaketDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && paketId) {
      void loadDetail(paketId)
    } else {
      setPaket(null)
      setError(null)
    }
  }, [open, paketId])

  const loadDetail = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/hargapakets/${id}`)
      if (!res.ok) throw new Error('Gagal memuat detail paket')
      const result = await res.json()
      setPaket(result.data || result)
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
      title="Detail Harga Paket"
      size="2xl"
    >
      <HargaDetailContent
        paket={paket}
        loading={loading}
        error={error}
      />
    </Modal>
  )
}
