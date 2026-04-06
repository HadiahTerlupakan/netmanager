import { describe, expect, it, vi } from 'vitest'

import {
  ensurePrismaMigrationHistory,
  getBackupPrismaConfig,
} from '@/modules/settings/lib/prismaMigrationHistory'

const testEnv: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: 'test',
  PATH: process.env.PATH ?? '/usr/bin',
}

describe('getBackupPrismaConfig', () => {
  it('returns the expected Prisma config for billing', () => {
    expect(getBackupPrismaConfig('billing')).toEqual({
      config: 'prisma.billing.config.ts',
      migrationsDir: 'prisma/billing_migrations',
      schemaPath: 'prisma/billing.prisma',
    })
  })

  it('returns null for unknown databases', () => {
    expect(getBackupPrismaConfig('unknown')).toBeNull()
  })
})

describe('ensurePrismaMigrationHistory', () => {
  it('skips baselining when migration history already exists', async () => {
    const runCommand = vi.fn().mockResolvedValue({ stdout: '3\n', stderr: '' })

    await ensurePrismaMigrationHistory({
      dbName: 'netmanager',
      database: 'netmanager',
      pgPrefix: 'export PGHOST=db-netmanager;',
      psqlBin: 'psql',
      prismaBin: 'prisma',
      projectRoot: '/repo',
      env: testEnv,
      runCommand,
      listMigrationNames: () => ['20251105130408_init'],
    })

    expect(runCommand).toHaveBeenCalledTimes(1)
    expect(runCommand.mock.calls[0]?.[0]).toContain('information_schema.tables')
  })

  it('fails fast when schema is not equivalent before baselining', async () => {
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '-1\n', stderr: '' })
      .mockRejectedValueOnce(new Error('drift detected'))

    await expect(
      ensurePrismaMigrationHistory({
        dbName: 'radius',
        database: 'radius',
        pgPrefix: 'export PGHOST=db-radius;',
        psqlBin: 'psql',
        prismaBin: 'prisma',
        projectRoot: '/repo',
        env: testEnv,
        runCommand,
        listMigrationNames: () => ['20260221234443_init'],
      })
    ).rejects.toThrow('drift detected')

    expect(runCommand).toHaveBeenCalledTimes(2)
    expect(runCommand.mock.calls[1]?.[0]).toContain('migrate diff')
    expect(runCommand.mock.calls[1]?.[0]).toContain('--config=prisma.radius.config.ts')
  })

  it('marks all migrations as applied when history is missing but schema matches', async () => {
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '-1\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValue({ stdout: '', stderr: '' })

    await ensurePrismaMigrationHistory({
      dbName: 'mitra',
      database: 'mitra',
      pgPrefix: 'export PGHOST=db-mitra;',
      psqlBin: 'psql',
      prismaBin: 'prisma',
      projectRoot: '/repo',
      env: testEnv,
      runCommand,
      listMigrationNames: () => ['20260306060000_init', '202603081309_add_mitra_version_tracking'],
    })

    expect(runCommand).toHaveBeenCalledTimes(4)
    expect(runCommand.mock.calls[2]?.[0]).toContain('migrate resolve --config=prisma.mitra.config.ts --applied 20260306060000_init')
    expect(runCommand.mock.calls[3]?.[0]).toContain('migrate resolve --config=prisma.mitra.config.ts --applied 202603081309_add_mitra_version_tracking')
  })
})
