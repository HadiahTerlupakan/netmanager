"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Modal from '@/components/common/Modal'
import { useToast } from '@/components/common/ToastProvider'
import { joinboxCreateSchema } from '@/lib/validations/joinbox'
import { HiTrash } from 'react-icons/hi2'

const MapPicker = dynamic(() => import('@/components/common/MapPicker').then(m => m.default), { ssr: false })
const MapPickerWithSearch = dynamic(() => import('@/components/common/MapPicker').then(m => m.MapPickerWithSearch), { ssr: false })

type IORow = { idx: number; inputUnit: string; portUnit: string; tubeColor: string; coreColor: string }

export type JoinboxFormInitial = {
  id?: string
  name?: string
  location?: string | null
  notes?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  inputs?: IORow[]
  outputs?: IORow[]
}

export function JoinboxForm({ initial, mode }: { initial?: JoinboxFormInitial; mode: 'create' | 'edit' }) {
  const router = useRouter()
  const { show } = useToast()
  const [name, setName] = useState(initial?.name ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [latitude, setLatitude] = useState<string>(initial?.latitude != null ? String(initial.latitude) : '')
  const [longitude, setLongitude] = useState<string>(initial?.longitude != null ? String(initial.longitude) : '')
  const [status, setStatus] = useState<'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'>(initial?.status ?? 'AKTIF')
  const [inputs, setInputs] = useState<IORow[]>(initial?.inputs ?? [])
  const [outputs, setOutputs] = useState<IORow[]>(initial?.outputs ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  const [jumlahInput, setJumlahInput] = useState<number>(inputs.length)
  const [jumlahOutput, setJumlahOutput] = useState<number>(outputs.length)
  const standard12Colors = ['Biru', 'Oranye', 'Hijau', 'Coklat', 'Slate', 'Putih', 'Merah', 'Hitam', 'Kuning', 'Ungu', 'Rose', 'Aqua']
  const tubeColorOptions = ['Non-tube', ...standard12Colors]

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

  // Opsi untuk INPUT UNIT dan PORT UNIT diambil dari OTB, ODC, dan JOINbox yang ada
  type UnitOption = { value: string; label: string }
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([])
  const [inputPortOptions, setInputPortOptions] = useState<Record<number, string[]>>({})
  const [outputPortOptions, setOutputPortOptions] = useState<Record<number, string[]>>({})

  useEffect(() => {
    ;(async () => {
      const options: UnitOption[] = []
      try {
        // OTB
        const otbRes = await fetch('/api/otbs')
        if (otbRes.ok) {
          const j = await otbRes.json()
          ;(j?.otbs || []).forEach((o: any) => { if (o?.id && o?.name) options.push({ value: `otb:${o.id}`, label: `OTB — ${o.name}` }) })
        }
      } catch {}
      try {
        // ODC
        const odcRes = await fetch('/api/odcs')
        if (odcRes.ok) {
          const j = await odcRes.json()
          ;(j?.odcs || []).forEach((o: any) => { if (o?.id && o?.name) options.push({ value: `odc:${o.id}`, label: `ODC — ${o.name}` }) })
        }
      } catch {}
      try {
        // JOINbox
        const jbRes = await fetch('/api/joinboxes')
        if (jbRes.ok) {
          const j = await jbRes.json()
          ;(j?.items || []).forEach((o: any) => { if (o?.id && o?.name) options.push({ value: `jb:${o.id}`, label: `JB — ${o.name}` }) })
        }
      } catch {}
      // Sertakan nilai existing sebagai custom option agar tetap terlihat
      const addCustom = (val?: string) => {
        if (val && !options.some((o) => o.label === val)) options.push({ value: `custom:${val}`, label: val })
      }
      ;(initial?.inputs || []).forEach((r) => { addCustom(r?.inputUnit); addCustom(r?.portUnit) })
      ;(initial?.outputs || []).forEach((r) => { addCustom(r?.inputUnit); addCustom(r?.portUnit) })
      setUnitOptions(options)
    })()
  }, [])

  // Normalisasi nilai awal pada mode edit: map label -> option.value dan muat daftar port
  useEffect(() => {
    if (!unitOptions.length) return
    const normalize = async () => {
      // Inputs
      const nextInputs = [...inputs]
      for (let i = 0; i < nextInputs.length; i++) {
        const r = nextInputs[i]
        const match = unitOptions.find((o) => o.value === r.inputUnit || o.label === r.inputUnit)
        if (match) {
          if (r.inputUnit !== match.value) {
            r.inputUnit = match.value
          }
          const ports = await loadPortsFor(match.value)
          setInputPortOptions((m) => ({ ...m, [i]: ports }))
          // pastikan port lama tetap ada di opsi
          if (r.portUnit && ports.length > 0 && !ports.includes(r.portUnit)) {
            setInputPortOptions((m) => ({ ...m, [i]: [r.portUnit, ...ports] }))
          }
        } else if (r.inputUnit) {
          // Jika tidak ada match, jadikan custom
          r.inputUnit = `custom:${r.inputUnit}`
          setInputPortOptions((m) => ({ ...m, [i]: r.portUnit ? [r.portUnit] : [] }))
        }
      }
      setInputs(nextInputs)

      // Outputs
      const nextOutputs = [...outputs]
      for (let i = 0; i < nextOutputs.length; i++) {
        const r = nextOutputs[i]
        const match = unitOptions.find((o) => o.value === r.inputUnit || o.label === r.inputUnit)
        if (match) {
          if (r.inputUnit !== match.value) {
            r.inputUnit = match.value
          }
          const ports = await loadPortsFor(match.value)
          setOutputPortOptions((m) => ({ ...m, [i]: ports }))
          if (r.portUnit && ports.length > 0 && !ports.includes(r.portUnit)) {
            setOutputPortOptions((m) => ({ ...m, [i]: [r.portUnit, ...ports] }))
          }
        } else if (r.inputUnit) {
          r.inputUnit = `custom:${r.inputUnit}`
          setOutputPortOptions((m) => ({ ...m, [i]: r.portUnit ? [r.portUnit] : [] }))
        }
      }
      setOutputs(nextOutputs)
    }
    normalize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitOptions])

  async function loadPortsFor(unitValue: string): Promise<string[]> {
    if (!unitValue) return []
    const [prefix, idOrLabel] = unitValue.split(':', 2)
    try {
      if (prefix === 'otb') {
        const res = await fetch(`/api/otbs/${idOrLabel}`)
        if (res.ok) {
          const j = await res.json()
          const cores = (j?.otb?.cores || []) as any[]
          return cores.sort((a, b) => a.idx - b.idx).map((c) => `SLOT-${c.idx + 1}: ${c.slotName}`)
        }
      } else if (prefix === 'odc') {
        const res = await fetch(`/api/odcs/${idOrLabel}`)
        if (res.ok) {
          const j = await res.json()
          const outs = (j?.odc?.outputs || []) as any[]
          return outs.sort((a, b) => a.idx - b.idx).map((o) => o.slotName)
        }
      } else if (prefix === 'jb') {
        const res = await fetch(`/api/joinboxes/${idOrLabel}`)
        if (res.ok) {
          const j = await res.json()
          const ins = (j?.joinbox?.inputs || []) as any[]
          const outs = (j?.joinbox?.outputs || []) as any[]
          return [
            ...ins.sort((a, b) => a.idx - b.idx).map((r) => `IN-${r.idx + 1}: ${r.portUnit || r.inputUnit}`),
            ...outs.sort((a, b) => a.idx - b.idx).map((r) => `OUT-${r.idx + 1}: ${r.portUnit || r.inputUnit}`),
          ]
        }
      } else if (prefix === 'custom') {
        return [idOrLabel]
      }
    } catch {}
    return []
  }

  function addRow(which: 'inputs' | 'outputs') {
    const list = which === 'inputs' ? inputs : outputs
    const next: IORow = { idx: list.length, inputUnit: '', portUnit: '', tubeColor: 'Non-tube', coreColor: 'Biru' }
    ;(which === 'inputs' ? setInputs : setOutputs)([...list, next])
  }

  function removeRow(which: 'inputs' | 'outputs', idx: number) {
    const list = (which === 'inputs' ? inputs : outputs).filter((_, i) => i !== idx)
    const relabeled = list.map((r, i) => ({ ...r, idx: i }))
    ;(which === 'inputs' ? setInputs : setOutputs)(relabeled)
  }

  async function updateRow(which: 'inputs' | 'outputs', i: number, field: keyof IORow, value: string) {
    const list = [...(which === 'inputs' ? inputs : outputs)]
    ;(list[i] as any)[field] = field === 'idx' ? Number(value) : value
    ;(which === 'inputs' ? setInputs : setOutputs)(list)

    if (field === 'inputUnit') {
      const ports = await loadPortsFor(value)
      if (which === 'inputs') setInputPortOptions((m) => ({ ...m, [i]: ports }))
      else setOutputPortOptions((m) => ({ ...m, [i]: ports }))
      // reset selected port when unit changes
      updateRow(which, i, 'portUnit', '')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setError(null)
    setSaving(true)
    // Filter baris yang sudah lengkap (inputUnit dan portUnit harus diisi)
    const validInputs = inputs
      .filter((r) => r.inputUnit.trim() !== '' && r.portUnit.trim() !== '')
      .map((r, i) => ({ ...r, idx: i }))
    const validOutputs = outputs
      .filter((r) => r.inputUnit.trim() !== '' && r.portUnit.trim() !== '')
      .map((r, i) => ({ ...r, idx: i }))

    const valueToLabel = (val: string): string => {
      const opt = unitOptions.find((o) => o.value === val)
      if (opt) return opt.label
      if (val?.startsWith('custom:')) return val.slice(7)
      return val || ''
    }

    const payload = {
      name,
      location: location || null,
      notes: notes || null,
      latitude: latitude === '' ? null : Number(latitude),
      longitude: longitude === '' ? null : Number(longitude),
      status,
      inputs: validInputs.map((r, i) => ({ ...r, idx: i, inputUnit: valueToLabel(r.inputUnit) })),
      outputs: validOutputs.map((r, i) => ({ ...r, idx: i, inputUnit: valueToLabel(r.inputUnit) })),
    }
    const parsed = joinboxCreateSchema.safeParse(payload)
    if (!parsed.success) {
      setSaving(false)
      const errors = parsed.error.flatten().fieldErrors
      const errorMessages: string[] = []
      if (errors.name) errorMessages.push(`Nama: ${errors.name[0]}`)
      if (errors.inputs) errorMessages.push(`Input: ${errors.inputs[0]}`)
      if (errors.outputs) errorMessages.push(`Output: ${errors.outputs[0]}`)
      // Check nested errors
      const allErrors = parsed.error.errors
      allErrors.forEach((err) => {
        if (err.path.includes('inputUnit')) errorMessages.push('Input Unit wajib diisi')
        if (err.path.includes('portUnit')) errorMessages.push('Port Unit wajib diisi')
        if (err.path.includes('tubeColor')) errorMessages.push('Tube Color wajib diisi')
        if (err.path.includes('coreColor')) errorMessages.push('Core Color wajib diisi')
      })
      setError(errorMessages.length > 0 ? errorMessages.join('. ') : 'Validasi gagal. Periksa kembali data yang diisi.')
      return
    }
    const res = await fetch(mode === 'create' ? '/api/joinboxes' : `/api/joinboxes/${initial?.id}`, {
      method: mode === 'create' ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      show({ type: 'success', title: 'Berhasil', message: `JOINbox ${mode === 'create' ? 'dibuat' : 'diperbarui'}.` })
      router.push('/admin/ftth/closure')
      router.refresh()
    } else {
      let msg = 'Gagal menyimpan data.'
      try { const j = await res.json(); if (j?.error) msg = String(j.error) } catch {}
      setError(msg)
    }
  }

  function renderTable(which: 'inputs' | 'outputs', title: string) {
    const rows = which === 'inputs' ? inputs : outputs
    return (
      <div className="space-y-4">
        <h2 className="text-md font-semibold text-gray-900 dark:text-white">{title}</h2>

        <div className="space-y-1 max-w-xs">
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Jumlah Core</label>
          <input
            type="number"
            min={0}
            step={1}
            value={(which === 'inputs' ? jumlahInput : jumlahOutput) || ''}
            onChange={(e) => {
              const v = parseInt(e.target.value || '0')
              const num = Number.isNaN(v) ? 0 : Math.max(0, v)
              if (which === 'inputs') {
                setJumlahInput(num)
                setInputs((prev) => {
                  const next = [...prev]
                  if (num > next.length) {
                    for (let i = next.length; i < num; i++) next.push({ idx: i, inputUnit: '', portUnit: '', tubeColor: 'Non-tube', coreColor: 'Biru' })
                  } else if (num < next.length) {
                    next.length = num
                  }
                  return next.map((r, i) => ({ ...r, idx: i }))
                })
              } else {
                setJumlahOutput(num)
                setOutputs((prev) => {
                  const next = [...prev]
                  if (num > next.length) {
                    for (let i = next.length; i < num; i++) next.push({ idx: i, inputUnit: '', portUnit: '', tubeColor: 'Non-tube', coreColor: 'Biru' })
                  } else if (num < next.length) {
                    next.length = num
                  }
                  return next.map((r, i) => ({ ...r, idx: i }))
                })
              }
            }}
            placeholder="Masukkan jumlah baris"
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </div>

        {(rows.length > 0) && (
          <div className="rounded-md border border-gray-200 dark:border-gray-800">
            <div className="grid grid-cols-12 items-center border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              <div className="col-span-3 px-3 py-2 text-xs font-semibold">INPUT UNIT</div>
              <div className="col-span-3 px-3 py-2 text-xs font-semibold">PORT UNIT</div>
              <div className="col-span-3 px-3 py-2 text-xs font-semibold">Tube Color</div>
              <div className="col-span-2 px-3 py-2 text-xs font-semibold">Core Color</div>
              <div className="col-span-1 px-3 py-2 text-xs font-semibold"></div>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-12 items-center px-3 py-2 gap-2">
                  <div className="col-span-3">
                    <select className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm" value={r.inputUnit} onChange={(e) => updateRow(which, i, 'inputUnit', e.target.value)}>
                      <option value="">-- Pilih Unit --</option>
                      {unitOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <select className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm" value={r.portUnit} onChange={(e) => updateRow(which, i, 'portUnit', e.target.value)}>
                      <option value="">-- Pilih Port --</option>
                      {(which === 'inputs' ? (inputPortOptions[i] || []) : (outputPortOptions[i] || [])).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <select className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm" value={r.tubeColor} onChange={(e) => updateRow(which, i, 'tubeColor', e.target.value)}>
                      {tubeColorOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <select className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm" value={r.coreColor} onChange={(e) => updateRow(which, i, 'coreColor', e.target.value)}>
                      {standard12Colors.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                  </div>
                  <div className="col-span-1 flex justify-end"><button type="button" onClick={() => removeRow(which, i)} className="inline-flex items-center justify-center h-8 w-8 rounded text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20" aria-label="Hapus">
                    <HiTrash className="h-4 w-4" />
                  </button></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="space-y-4">
        <h2 className="text-md font-semibold text-gray-900 dark:text-white">Data Dasar</h2>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Nama JOINbox</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Contoh: JB-01" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Lokasi (opsional)</label>
            <input value={location ?? ''} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Contoh: Tiang 12" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Catatan (opsional)</label>
            <textarea value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Keterangan tambahan" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE')} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
              <option value="AKTIF">Aktif</option>
              <option value="NONAKTIF">Nonaktif</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
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
      </div>

      {renderTable('inputs', 'INPUT')}
      {renderTable('outputs', 'OUTPUT')}

      {error && (<div className="text-sm text-red-600 dark:text-red-400">{error}</div>)}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">{saving ? 'Menyimpan...' : (mode === 'create' ? 'Simpan' : 'Update')}</button>
      </div>
    </form>
  )
}


