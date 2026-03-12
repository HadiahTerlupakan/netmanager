import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import RABRevisionForm from '@/app/admin/integrations/mixradius/expenses/RABRevisionForm'

describe('RABRevisionForm', () => {
  it('requires a revision reason before submission', () => {
    const html = renderToStaticMarkup(
      React.createElement(RABRevisionForm, {
        open: true,
        projectId: 'rab-1',
        projectName: 'Project Fiber',
        onClose: vi.fn(),
        onSaved: vi.fn(),
      }),
    )

    expect(html).toContain('Simpan Draft')
    expect(html).toContain('Alasan Revisi')
    expect(html).toContain('required')
  })
})
