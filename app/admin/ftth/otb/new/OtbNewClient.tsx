"use client"

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useToast } from '@/components/common/ToastProvider'
import ImageUpload from '@/components/common/ImageUpload'

const MapPicker = dynamic(() => import('@/components/common/MapPicker').then(m => m.default), { ssr: false })
const MapPickerWithSearch = dynamic(() => import('@/components/common/MapPicker').then(m => m.MapPickerWithSearch), { ssr: false })
import Modal from '@/components/common/Modal'

// Module-level constants
const STANDARD_12_COLORS = ['Biru', 'Oranye', 'Hijau', 'Coklat', 'Slate', 'Putih', 'Merah', 'Hitam', 'Kuning', 'Ungu', 'Rose', 'Aqua'] as const
const TUBE_COLOR_OPTIONS = ['Non-tube', ...STANDARD_12_COLORS] as const

export function ClientComponent() {
  const router = useRouter()
  const { show } = useToast()
  const [name, setName] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [coreCount, setCoreCount] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [keteranganJumlahKabelFeeder, setKeteranganJumlahKabelFeeder] = useState('')
  const [latitude, setLatitude] = useState<string>('')
  const [longitude, setLongitude] = useState<string>('')
  const [status, setStatus] = useState<'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'>('AKTIF')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const [cores, setCores] = useState<Array<{ idx: number; slotName: string; tubeColor: string; coreColor: string }>>([])
  const [mapOpen, setMapOpen] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // Reverse geocoding otomatis ketika koordinat diisi
  useEffect(() => {
    // Skip pada initial load
    if (isInitialLoad) {
      setIsInitialLoad(false)
      return
    }

    // Skip jika salah satu koordinat kosong
    if (!latitude || !longitude) return

    const latNum = parseFloat(latitude)
    const lonNum = parseFloat(longitude)

    // Validasi koordinat
    if (isNaN(latNum) || isNaN(lonNum)) return
    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) return

    // Hanya update location jika masih kosong
    if (location.trim()) return

    // Debounce untuk menghindari terlalu banyak request
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`)
        if (res.ok) {
          const j = await res.json()
          if (j?.displayName) {
            setLocation(j.displayName)
          }
        }
      } catch (e) {
        // Abaikan error, user bisa isi manual
      }
    }, 1000) // Debounce 1 detik

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude])

  // Sinkronkan jumlah baris cores dengan coreCount
  useEffect(() => {
    setCores((prev) => {
      if (coreCount <= 0) return []
      const next = [...prev]
      if (coreCount > next.length) {
        for (let i = next.length; i < coreCount; i++) {
          next.push({ idx: i, slotName: `SLOT-${i + 1}`, tubeColor: 'Non-tube', coreColor: STANDARD_12_COLORS[0] })
        }
      } else if (coreCount < next.length) {
        next.length = coreCount
      }
      return next
    })
  }, [coreCount])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/otbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          images: images,
          location: location || null,
          coreCount,
          notes: notes || null,
          keteranganJumlahKabelFeeder: keteranganJumlahKabelFeeder || null,
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
          status,
          cores: cores.map((c, i) => ({
            idx: i,
            slotName: c.slotName || `SLOT-${i + 1}`,
            tubeColor: c.tubeColor,
            coreColor: c.coreColor,
          })),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || 'Gagal menyimpan OTB')
      }
      show({ type: 'success', title: 'Berhasil', message: 'OTB dibuat.' })
      router.push('/admin/ftth/otb')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah OTB</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Isi data OTB berikut lalu simpan.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Nama OTB</label>
          <input
            name="name"
            data-testid="otb-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            placeholder="Contoh: OTB-RT01"
          />
        </div>

        <div className="space-y-1">
          <ImageUpload
            label="Foto OTB (opsional)"
            value={images}
            onChange={setImages}
            folder="ftth/otb"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Lokasi (opsional)</label>
          <input
            name="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            placeholder="Contoh: Jl. Merdeka No. 1"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Catatan (opsional)</label>
          <textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            placeholder="Keterangan tambahan"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Keterangan Jumlah Kabel Feeder (opsional)</label>
          <input
            name="keteranganJumlahKabelFeeder"
            value={keteranganJumlahKabelFeeder}
            onChange={(e) => setKeteranganJumlahKabelFeeder(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            placeholder="Contoh: 12 Core, 24 Core, dll"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Status</label>
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE')}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          >
            <option value="AKTIF">Aktif</option>
            <option value="NONAKTIF">Nonaktif</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Latitude (opsional)</label>
            <input
              name="latitude"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              type="number"
              step="any"
              min={-90}
              max={90}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Contoh: -6.200000"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Longitude (opsional)</label>
            <input
              name="longitude"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              type="number"
              step="any"
              min={-180}
              max={180}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Contoh: 106.816666"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!navigator.geolocation) {
                setError('Browser tidak mendukung geolocation')
                return
              }
              setError(null)
              setLocLoading(true)
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  try {
                    const lat = String(pos.coords.latitude)
                    const lon = String(pos.coords.longitude)
                    setLatitude(lat)
                    setLongitude(lon)
                    const res = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`)
                    if (res.ok) {
                      const j = await res.json()
                      if (j?.displayName) setLocation(j.displayName)
                    }
                  } catch (e) {
                    // abaikan, field lat/long sudah terisi
                  } finally {
                    setLocLoading(false)
                  }
                },
                (err) => {
                  setError(err.message || 'Gagal mendapatkan lokasi')
                  setLocLoading(false)
                },
                { enableHighAccuracy: true, timeout: 10000 }
              )
            }}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm"
          >
            {locLoading ? 'Mengambil lokasi…' : 'Gunakan Lokasi Saya'}
          </button>
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm"
          >
            Pilih di Peta
          </button>
        </div>

        <Modal open={mapOpen} onClose={() => setMapOpen(false)} title="Pilih Lokasi di Peta">
          <MapPickerWithSearch
            lat={latitude ? Number(latitude) : null}
            lon={longitude ? Number(longitude) : null}
            onChange={async (la, lo) => {
              setLatitude(String(la))
              setLongitude(String(lo))
              // Reverse geocoding ketika pilih di peta
              try {
                const res = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(String(la))}&lon=${encodeURIComponent(String(lo))}`)
                if (res.ok) {
                  const j = await res.json()
                  if (j?.displayName && !location.trim()) {
                    setLocation(j.displayName)
                  }
                }
              } catch (e) {
                // Abaikan error
              }
            }}
          />
        </Modal>

        {/* Bagian paling bawah: Jumlah Core + Tabel Cores */}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Jumlah Core</label>
            <input
              name="coreCount"
              data-testid="otb-corecount-input"
              type="number"
              min={1}
              step={1}
              value={coreCount || ''}
              onChange={(e) => {
                const v = parseInt(e.target.value || '0')
                setCoreCount(Number.isNaN(v) ? 0 : Math.max(0, v))
              }}
              placeholder="Masukkan jumlah core (mulai 1)"
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>

          {coreCount > 0 && (
            <div className="rounded-md border border-gray-200 dark:border-gray-800">
              <div className="grid grid-cols-12 items-center border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                <div className="col-span-4 px-3 py-2 text-xs font-semibold">NAMA SLOT</div>
                <div className="col-span-4 px-3 py-2 text-xs font-semibold">Tube Color</div>
                <div className="col-span-4 px-3 py-2 text-xs font-semibold">Core Color</div>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {cores.map((row, i) => (
                  <div key={i} className="grid grid-cols-12 items-center px-3 py-2 gap-2">
                    <div className="col-span-4">
                      <input
                        value={row.slotName}
                        onChange={(e) => setCores((prev) => prev.map((r, idx) => idx === i ? { ...r, slotName: e.target.value } : r))}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm"
                        placeholder={`SLOT-${i + 1}`}
                      />
                    </div>
                    <div className="col-span-4">
                      <select
                        value={row.tubeColor}
                        onChange={(e) => setCores((prev) => prev.map((r, idx) => idx === i ? { ...r, tubeColor: e.target.value } : r))}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm"
                      >
                        {TUBE_COLOR_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4">
                      <select
                        value={row.coreColor}
                        onChange={(e) => setCores((prev) => prev.map((r, idx) => idx === i ? { ...r, coreColor: e.target.value } : r))}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm"
                      >
                        <option value="">Pilih warna</option>
                        {STANDARD_12_COLORS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            data-testid="otb-submit-button"
          >
            {loading ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-200"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  )
}


