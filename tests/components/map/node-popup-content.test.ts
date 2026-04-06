import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { MappingNode } from '@/components/map/map-types'

const node = {
  nodeId: 'node-1',
  type: 'odc',
  name: 'ODC Alpha',
  latitude: -6.2,
  longitude: 106.8,
  capacity: 8,
  splitter: '1:8',
  pppoe: null,
  serialNumber: 'SN-001',
  notes: 'Test note',
  attenuationIn: -18.5,
  attenuationOut: -19.2,
  inputCoreColor: 'Biru',
  photo: 'https://example.com/photo.jpg',
  metadata: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
} as MappingNode

const connectedFromNode = {
  nodeId: 'node-2',
  type: 'odp',
  name: 'ODP Beta',
  latitude: -6.21,
  longitude: 106.81,
  capacity: 8,
  splitter: '1:8',
  pppoe: null,
  serialNumber: 'SN-002',
  notes: null,
  attenuationIn: null,
  attenuationOut: null,
  inputCoreColor: null,
  photo: null,
  metadata: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
} as MappingNode

async function renderPopup() {
  const { NodePopupContent } = await import('@/components/map/NodePopupContent')

  return renderToStaticMarkup(
    React.createElement(NodePopupContent, {
      node,
      connectedFromNodes: [connectedFromNode],
      connectedToNodes: [connectedFromNode],
      usedSlots: 3,
      capacity: 8,
      onCopyInfo: vi.fn(),
      onEditNode: vi.fn(),
      onEditNodeLocation: vi.fn(),
      onDeleteNode: vi.fn(),
    })
  )
}

describe('NodePopupContent', () => {
  it('renders node popup details and actions', async () => {
    const markup = await renderPopup()

    expect(markup).toContain('ODC Cabinet')
    expect(markup).toContain('ODC Alpha')
    expect(markup).toContain('-6.200000, 106.800000')
    expect(markup).toContain('Copy Info')
    expect(markup).toContain('Slot Usage')
    expect(markup).toContain('Optical Info')
    expect(markup).toContain('Connected from:')
    expect(markup).toContain('Connected to ODPs:')
    expect(markup).toContain('Edit ODC')
    expect(markup).toContain('Edit Location')
    expect(markup).toContain('Delete')
  })
})
