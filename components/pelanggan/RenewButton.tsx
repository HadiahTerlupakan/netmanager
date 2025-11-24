"use client"

import { useState, useEffect } from 'react'
import { HiArrowPath, HiCheckCircle, HiExclamationCircle } from 'react-icons/hi2'
import { useRouter } from 'next/navigation'

interface RenewButtonProps {
  pelangganId: string
  onSuccess?: () => void
}

interface RenewStatus {
  disabled: boolean
  hariSebelumJatuhTempo: number
  selisihHari: number
  message: string
}

export default function RenewButton({ pelangganId, onSuccess }: RenewButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [renewStatus, setRenewStatus] = useState<RenewStatus | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)

  useEffect(() => {
    // Cek status disable perpanjangan
    const checkRenewStatus = async () => {
      try {
        const token = localStorage.getItem('pelanggan_token')
        const res = await fetch(`/api/pelanggan-ppp/${pelangganId}/check-renew`, {
          headers: {
            'x-pelanggan-token': token || '',
          },
        })

        if (res.ok) {
          const data = await res.json()
          setRenewStatus(data)
        }
      } catch (error) {
        console.error('Error checking renew status:', error)
      } finally {
        setCheckingStatus(false)
      }
    }

    checkRenewStatus()
  }, [pelangganId])

  const handleRenew = async () => {
    if (!confirm('Apakah Anda yakin ingin memperpanjang layanan pelanggan ini? Tagihan baru akan dibuat untuk periode berikutnya.')) {
      return
    }

    try {
      setLoading(true)
      setSuccess(false)

      const res = await fetch(`/api/pelanggan-ppp/${pelangganId}/renew`, {
        method: 'POST',
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Gagal memperpanjang layanan')
      }

      const data = await res.json()
      setSuccess(true)

      if (onSuccess) {
        onSuccess()
      } else {
        // Refresh halaman setelah 1 detik
        setTimeout(() => {
          router.refresh()
        }, 1000)
      }

      alert(`Layanan berhasil diperpanjang!\nJatuh Tempo Baru: ${new Date(data.jatuhTempoBaru).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`)
    } catch (error: any) {
      alert(error.message || 'Terjadi kesalahan saat memperpanjang layanan')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <button
        disabled
        className="text-sm px-4 py-2 rounded-lg bg-green-600 text-white inline-flex items-center gap-2 opacity-75 cursor-not-allowed"
      >
        <HiCheckCircle className="w-4 h-4" />
        Berhasil Diperpanjang
      </button>
    )
  }

  if (checkingStatus) {
    return (
      <button
        disabled
        className="text-sm px-4 py-2 rounded-lg bg-gray-400 text-white inline-flex items-center gap-2 opacity-50 cursor-not-allowed"
      >
        <HiArrowPath className="w-4 h-4 animate-spin" />
        Memeriksa...
      </button>
    )
  }

  if (renewStatus?.disabled) {
    return (
      <div className="inline-flex flex-col items-end gap-1">
        <button
          disabled
          className="text-sm px-4 py-2 rounded-lg bg-gray-400 text-white inline-flex items-center gap-2 opacity-50 cursor-not-allowed"
        >
          <HiExclamationCircle className="w-4 h-4" />
          Perpanjangan Dinonaktifkan
        </button>
        <span className="text-xs text-gray-500 text-right max-w-[200px]">
          {renewStatus.message}
        </span>
      </div>
    )
  }

  return (
    <button
      onClick={handleRenew}
      disabled={loading}
      className="text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <HiArrowPath className="w-4 h-4 animate-spin" />
          Memproses...
        </>
      ) : (
        <>
          <HiArrowPath className="w-4 h-4" />
          Perpanjang Layanan
        </>
      )}
    </button>
  )
}


