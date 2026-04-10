import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)

export function isCiEnvironment(env) {
  return env.CI === 'true'
}

export function isHuskyDisabled(env) {
  return env.HUSKY === '0'
}

export function hasGitDirectory(cwd) {
  return existsSync(resolve(cwd, '.git'))
}

export function hasGitCommand() {
  const result = spawnSync('git', ['--version'], { stdio: 'ignore' })
  return result.status === 0
}

export function shouldInstallHusky(options = {}) {
  const env = options.env ?? process.env
  const cwd = options.cwd ?? process.cwd()
  const gitDirectoryExists = options.gitDirectoryExists ?? hasGitDirectory(cwd)
  const gitCommandExists = options.gitCommandExists ?? hasGitCommand()

  if (isCiEnvironment(env) || isHuskyDisabled(env)) return false
  if (!gitDirectoryExists || !gitCommandExists) return false

  return true
}

export function installHusky() {
  const huskyBinPath = require.resolve('husky/bin.js')
  const result = spawnSync(process.execPath, [huskyBinPath], { stdio: 'inherit' })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

if (import.meta.url === new URL(process.argv[1], 'file://').href && shouldInstallHusky()) {
  installHusky()
}
