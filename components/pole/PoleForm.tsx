"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Modal from '@/components/common/Modal'
import { useToast } from '@/components/common/ToastProvider'
import { poleCreateSchema } from '@/lib/validations/pole'

const MapPickerWithSearch = dynamic(() => import('@/components/common/MapPicker').then(m => m.MapPickerWithSearch), { ssr: false })

export type PoleFormInitial = {
  id?: string
  name?: string
  location?: string | null
  notes?: string | null
  latitude?: number | null
  longitude?: number | null
  cableSlack?: boolean | null
}

export function PoleForm({ initial, mode }: { initial?: PoleFormInitial; mode: 'create' | 'edit' }) {
  const router = useRouter()
  const { show } = useToast()
  const [name, setName] = useState(initial?.name ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [latitude, setLatitude] = useState<string>(initial?.latitude != null ? String(initial.latitude) : '')
  const [longitude, setLongitude] = useState<string>(initial?.longitude != null ? String(initial.longitude) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [cableSlack, setCableSlack] = useState<boolean>(Boolean(initial?.cableSlack))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setError(null)
    const payload = {
      name,
      location: location || null,
      notes: notes || null,
      latitude: latitude === '' ? null : Number(latitude),
      longitude: longitude === '' ? null : Number(longitude),
      cableSlack,
    }
    const parsed = poleCreateSchema.safeParse(payload)
    if (!parsed.success) {
      const first = parsed.error.errors?.[0]?.message || 'Validasi gagal. Periksa kembali data yang diisi.'
      setError(first)
      return
    }
    setSaving(true)
    const res = await fetch(mode === 'create' ? '/api/poles' : `/api/poles/${initial?.id}` , {
      method: mode === 'create' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      show({ type: 'success', title: 'Berhasil', message: `Pole ${mode === 'create' ? 'dibuat' : 'diperbarui'}.` })
      router.push('/admin/ftth/pole')
      router.refresh()
    } else {
      let msg = 'Gagal menyimpan data.'
      try { const j = await res.json(); if (j?.error) msg = String(j.error) } catch {}
      setError(msg)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div className="space-y-4">
        <h2 className="text-md font-semibold text-gray-900 dark:text-white">Data Dasar</h2>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Nama Pole/Tiang</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Contoh: T-012" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Lokasi (opsional)</label>
          <input value={location ?? ''} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Contoh: Depan Ruko A" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Catatan (opsional)</label>
          <textarea value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Keterangan tambahan" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Latitude (opsional)</label>
            <input value={latitude} onChange={(e) => setLatitude(e.target.value)} type="number" step="any" min={-90} max={90} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Contoh: -6.200000" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Longitude (opsional)</label>
            <input value={longitude} onChange={(e) => setLongitude(e.target.value)} type="number" step="any" min={-180} max={180} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Contoh: 106.816666" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input id="cableSlack" type="checkbox" checked={cableSlack} onChange={(e) => setCableSlack(e.target.checked)} className="h-4 w-4" />
          <label htmlFor="cableSlack" className="text-sm text-gray-800 dark:text-gray-200">Ada Cable Slack</label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!navigator.geolocation) { setError('Browser tidak mendukung geolocation'); return }
              setLocLoading(true)
              navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                  const lat = String(pos.coords.latitude); const lon = String(pos.coords.longitude)
                  setLatitude(lat); setLongitude(lon)
                  try {
                    const res = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`)
                    if (res.ok) { const j = await res.json(); if (j?.displayName) setLocation(j.displayName) }
                  } catch {}
                } finally { setLocLoading(false) }
              }, (err) => { setError(err.message || 'Gagal mendapatkan lokasi'); setLocLoading(false) }, { enableHighAccuracy: true, timeout: 10000 })
            }}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm"
          >
            {locLoading ? 'Mengambil lokasi…' : 'Gunakan Lokasi Saya'}
          </button>
          <button type="button" onClick={() => setMapOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm">Pilih di Peta</button>
        </div>

        <Modal open={mapOpen} onClose={() => setMapOpen(false)} title="Pilih Lokasi di Peta">
          <MapPickerWithSearch
            lat={latitude ? Number(latitude) : null}
            lon={longitude ? Number(longitude) : null}
            onChange={async (la, lo) => {
              const lat = String(la); const lon = String(lo)
              setLatitude(lat); setLongitude(lon)
              try {
                const res = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`)
                if (res.ok) { const j = await res.json(); if (j?.displayName) setLocation(j.displayName) }
              } catch {}
            }}
          />
        </Modal>
      </div>

      {error && (<div className="text-sm text-red-600 dark:text-red-400">{error}</div>)}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">{saving ? 'Menyimpan...' : (mode === 'create' ? 'Simpan' : 'Update')}</button>
      </div>
    </form>
  )
}


