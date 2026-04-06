"use client"

import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Select } from '@/components/ui/select'
import { calculateMapDistance } from '@/components/map/map-utils'
import { buildFiberFormInitialState, getFiberTypeInfo, type FiberFormState } from '@/components/map/fiber-form-utils'
import type { FiberFormData, MappingNode } from '@/components/map/map-types'

interface FiberFormModalProps {
  isOpen: boolean
  data: FiberFormData | null
  nodes: MappingNode[]
  onClose: () => void
  onSave: (data: FiberFormState) => void
  onFiberTypeChange: (type: string) => void
}

export function FiberFormModal({
  isOpen,
  data,
  nodes,
  onClose,
  onSave,
  onFiberTypeChange,
}: FiberFormModalProps) {
  const [formData, setFormData] = useState<FiberFormState>({
    name: '',
    fiberType: 'distribution',
    notes: '',
  })

  const sourceNode = nodes.find((node) => node?.nodeId === data?.source)
  const targetNode = nodes.find((node) => node?.nodeId === data?.target)

  const distance = data && sourceNode && targetNode
    ? calculateMapDistance(
        sourceNode.latitude!,
        sourceNode.longitude!,
        targetNode.latitude!,
        targetNode.longitude!,
        data.waypoints
      )
    : 0

  const [prevData, setPrevData] = useState(data)

  if (data !== prevData) {
    setPrevData(data)

    if (data && sourceNode && targetNode) {
      setFormData(buildFiberFormInitialState({
        sourceName: sourceNode.name,
        targetName: targetNode.name,
        fiberType: data.fiberType,
      }))
    }
  }

  if (!isOpen || !data) return null

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSave(formData)
  }

  const fiberInfo = getFiberTypeInfo(formData.fiberType)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Fiber Line" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 flex items-center gap-4">
          <div className="p-2 bg-white dark:bg-blue-800 rounded-lg shadow-sm">
            <svg className="w-6 h-6 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-100">
              <span>{sourceNode?.name}</span>
              <span>→</span>
              <span>{targetNode?.name}</span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">Distance: {distance} m</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Label / Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
              placeholder="Enter fiber line name"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Auto-generated from source and target nodes</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fiber Type <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Select
                options={[
                  { value: 'distribution', label: 'Distribution (ODC to ODP)' },
                  { value: 'feeder', label: 'Feeder (Backbone)' },
                  { value: 'drop', label: 'Drop Cable' },
                  { value: 'odc_to_odc', label: 'ODC to ODC' },
                  { value: 'odp_to_odp', label: 'ODP to ODP' },
                ]}
                value={formData.fiberType}
                onChange={(value) => {
                  setFormData({ ...formData, fiberType: value })
                  onFiberTypeChange(value)
                }}
              />
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className={`w-3 h-3 rounded-full ${fiberInfo.color.replace('text-', 'bg-')}`}></div>
              {fiberInfo.label}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <ModalFooter>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Fiber Line
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
