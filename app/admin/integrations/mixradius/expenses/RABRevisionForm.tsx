'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'

import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'

import type { RABRevisionItem, RABRevisionRecord } from './rabRevisionTypes'

interface RABRevisionFormProps {
  open: boolean
  projectId: string
  projectName: string
  onClose: () => void
  onSaved: () => void
}

function normalizeNumber(value: string) {
  const cleaned = value.replace(/[^0-9]/g, '')

  return cleaned === '' ? '0' : cleaned
}

export default function RABRevisionForm({
  open,
  projectId,
  projectName,
  onClose,
  onSaved,
}: RABRevisionFormProps) {
  const [revision, setRevision] = useState<RABRevisionRecord | null>(null)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [projectedOpex, setProjectedOpex] = useState('0')
  const [items, setItems] = useState<RABRevisionItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const reasonInputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (open) {
      window.setTimeout(() => reasonInputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    if (!open || !projectId) {
      return
    }

    let isMounted = true

    const loadRevision = async () => {
      setIsLoading(true)

      try {
        const revisionsResponse = await fetch(`/api/finance/rab-projects/${projectId}/revisions`)
        const revisionsBody = await revisionsResponse.json()

        if (!revisionsResponse.ok) {
          throw new Error(revisionsBody.error || 'Gagal mengambil data revisi')
        }

        const latestDraft = (revisionsBody.data as RABRevisionRecord[]).find(
          (item) => item.status === 'DRAFT',
        )

        let activeRevision = latestDraft

        if (!activeRevision) {
          const createResponse = await fetch(`/api/finance/rab-projects/${projectId}/revisions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({}),
          })
          const createBody = await createResponse.json()

          if (!createResponse.ok) {
            throw new Error(createBody.error || 'Gagal membuat draft revisi')
          }

          activeRevision = createBody.data as RABRevisionRecord
        }

        if (!isMounted) {
          return
        }

        setRevision(activeRevision)
        setReason(activeRevision.reason || '')
        setNotes(activeRevision.notes || '')
        setProjectedOpex(activeRevision.totalOpex || '0')
        setItems(activeRevision.items || [])
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Gagal memuat revisi')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadRevision()

    return () => {
      isMounted = false
    }
  }, [open, projectId])

  const totalCapex = useMemo(
    () =>
      items.reduce((sum, item) => {
        if (item.expenseType === 'OPEX') {
          return sum
        }

        return sum + Number(item.totalPrice)
      }, 0),
    [items],
  )

  const handleItemChange = (
    index: number,
    field: keyof Pick<RABRevisionItem, 'quantity' | 'unitPrice' | 'expenseType'>,
    value: string,
  ) => {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item
        }

        const updatedItem = {
          ...item,
          [field]: field === 'quantity' ? Number(normalizeNumber(value)) : value,
        }

        const quantity = Number(updatedItem.quantity)
        const unitPrice = Number(updatedItem.unitPrice)

        return {
          ...updatedItem,
          totalPrice: String(quantity * unitPrice),
        }
      }),
    )
  }

  const persistDraft = async () => {
    if (!revision) {
      return false
    }

    const response = await fetch(`/api/finance/rab-projects/${projectId}/revisions/${revision.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        notes,
        projectedOpex: Number(normalizeNumber(projectedOpex)),
        items: items.map((item) => ({
          rabItemId: item.rabItemId,
          name: item.name,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          category: item.category,
          expenseType: item.expenseType,
          expenseCategoryId: item.expenseCategoryId,
          wbsId: item.wbsId,
          sortOrder: item.sortOrder,
        })),
      }),
    })
    const body = await response.json()

    if (!response.ok) {
      throw new Error(body.error || 'Gagal menyimpan draft revisi')
    }

    setRevision(body.data as RABRevisionRecord)

    return true
  }

  const handleSaveDraft = async () => {
    setIsSaving(true)

    try {
      await persistDraft()
      toast.success('Draft revisi berhasil disimpan')
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan draft revisi')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!revision) {
      return
    }

    setIsSaving(true)

    try {
      await persistDraft()

      const response = await fetch(
        `/api/finance/rab-projects/${projectId}/revisions/${revision.id}/submit`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason }),
        },
      )
      const body = await response.json()

      if (!response.ok) {
        throw new Error(body.error || 'Gagal mengajukan revisi')
      }

      toast.success('Revisi berhasil diajukan untuk approval')
      onSaved()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengajukan revisi')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} size="4xl" title={`Revisi RAB - ${projectName}`}>
      <ModalBody>
        <div className="space-y-5">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 text-sm text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200">
            <p className="font-semibold">Alur revisi yang disarankan</p>
            <p className="mt-1 text-xs leading-relaxed text-indigo-700 dark:text-indigo-300">
              1) Isi alasan revisi (wajib), 2) sesuaikan item dan OPEX draft, 3) simpan draft bila belum final atau ajukan approval jika siap ditinjau approver.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Proyek
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{projectName}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Revisi yang disetujui akan menjadi budget final untuk analisa variance.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Total CAPEX Draft
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(totalCapex)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  OPEX Final Draft
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(Number(projectedOpex || '0'))}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>Alasan Revisi (Wajib)</span>
              <textarea
                aria-label="Alasan Revisi"
                required
                ref={reasonInputRef}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-[96px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="Contoh: harga vendor naik 12% dan biaya operasional lapangan ikut berubah"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Alasan revisi akan terlihat oleh approver saat proses persetujuan.
              </p>
            </label>
            <div className="space-y-4">
              <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>Catatan Internal (Opsional)</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="min-h-[96px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                  placeholder="Catatan internal untuk approver atau finance"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>OPEX Draft Final</span>
                <input
                  type="text"
                  value={projectedOpex}
                  onChange={(event) => setProjectedOpex(normalizeNumber(event.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Perubahan Item</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Perbarui kuantitas, harga satuan, atau tipe biaya pada draft revisi.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Harga Satuan</th>
                    <th className="px-4 py-3">Tipe</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/80">
                  {isLoading ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={5}>
                        Memuat draft revisi...
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr key={item.id} className="align-top">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{item.name}</div>
                          {item.description && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.description}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(event) => handleItemChange(index, 'quantity', event.target.value)}
                            className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.unitPrice}
                            onChange={(event) => handleItemChange(index, 'unitPrice', normalizeNumber(event.target.value))}
                            className="w-36 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={item.expenseType}
                            onChange={(event) => handleItemChange(index, 'expenseType', event.target.value)}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          >
                            <option value="CAPEX">CAPEX</option>
                            <option value="OPEX">OPEX</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                          {formatCurrency(Number(item.totalPrice))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Tutup
        </Button>
        <Button variant="secondary" onClick={handleSaveDraft} disabled={isLoading || isSaving || !revision}>
          Simpan Draft
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isLoading || isSaving || !revision || reason.trim() === ''}
          title={reason.trim() === '' ? 'Isi alasan revisi terlebih dahulu' : 'Ajukan revisi untuk approval'}
        >
          {reason.trim() === '' ? 'Isi Alasan Dulu' : 'Ajukan Approval'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
