import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')

describe('rab revision schema contract', () => {
  it('tracks an immutable final approved revision separately from the base project', () => {
    const schema = readFileSync(schemaPath, 'utf8')

    expect(schema).toMatch(/finalApprovedRevisionId\s+String\?/) 
    expect(schema).toMatch(/finalApprovedRevision\s+RabRevision\?/) 
    expect(schema).toMatch(/revisions\s+RabRevision\[]/) 
    expect(schema).toContain('model RabRevision {')
    expect(schema).toContain('model RabRevisionItem {')
    expect(schema).toContain('model RabRevisionApproval {')
    expect(schema).toMatch(/@@unique\(\[rabProjectId, revisionNumber\]\)/)
  })
})
