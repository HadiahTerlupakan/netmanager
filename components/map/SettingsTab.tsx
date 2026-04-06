"use client"

import { useState } from 'react'
import type { MapSettings, MappingEdge } from '@prisma/client'

import { Button } from '@/components/ui/Button'
import { buildMapSettingsFormState } from '@/components/map/map-settings-utils'
import type { MappingNode } from '@/components/map/map-types'

interface SettingsTabProps {
  settings: MapSettings | null
  nodes: MappingNode[]
  edges: MappingEdge[]
  onSave: (data: Partial<MapSettings>) => void
  onExport: () => void
  onReset: (password: string) => void
}

export function SettingsTab({ settings, nodes, edges, onSave, onExport, onReset }: SettingsTabProps) {
  const [formData, setFormData] = useState(buildMapSettingsFormState(settings))
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [prevSettings, setPrevSettings] = useState(settings)

  if (settings !== prevSettings) {
    setPrevSettings(settings)
    setFormData(buildMapSettingsFormState(settings))
  }

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'

  return (
    <div className="flex-1 p-6 overflow-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Center Coordinates</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Latitude</label>
            <input type="text" value={formData.centerLat} onChange={(e) => setFormData({ ...formData, centerLat: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Longitude</label>
            <input type="text" value={formData.centerLng} onChange={(e) => setFormData({ ...formData, centerLng: e.target.value })} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Zoom Levels</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Max Zoom In</label>
            <input type="number" value={formData.maxZoomIn} onChange={(e) => setFormData({ ...formData, maxZoomIn: e.target.value })} min={1} max={22} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Max Zoom Out</label>
            <input type="number" value={formData.maxZoomOut} onChange={(e) => setFormData({ ...formData, maxZoomOut: e.target.value })} min={1} max={22} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Default Zoom</label>
            <input type="number" value={formData.defaultZoom} onChange={(e) => setFormData({ ...formData, defaultZoom: e.target.value })} min={1} max={22} className={inputClass} />
          </div>
        </div>
      </div>

      <Button onClick={() => onSave(formData)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Save Settings
      </Button>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Map Data Management</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          <Button variant="success" onClick={onExport}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Map
          </Button>
          <Button onClick={() => setShowResetModal(true)} className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Reset Map Data
          </Button>
        </div>
        <div className="flex gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <p className="font-medium mb-1">Information</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Coordinate format: Latitude (-90 to 90), Longitude (-180 to 180)</li>
              <li>Zoom levels range from 1 (world view) to 22 (street level)</li>
              <li>Export preserves all nodes, edges, and settings</li>
              <li>Reset will delete all map data (requires password)</li>
            </ul>
          </div>
        </div>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Reset Map Data</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">This will delete ALL nodes ({nodes.length}) and edges ({edges.length}). Enter your password to confirm.</p>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Enter password"
              className={`${inputClass} mb-4`}
            />
            <div className="flex gap-2">
              <Button onClick={() => { setShowResetModal(false); setResetPassword('') }} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</Button>
              <Button onClick={() => { onReset(resetPassword); setShowResetModal(false); setResetPassword('') }} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete All</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
