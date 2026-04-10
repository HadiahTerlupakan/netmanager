import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import husky from 'husky'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const HUSKY_INSTALL_DIRECTORY = '.husky'
const HUSKY_SKIP_MESSAGE = 'HUSKY=0 skip install'
const HUSKY_SUCCESS_MESSAGE = ''
const HUSKY_NOT_IN_GIT_MESSAGE = ".git can't be found"
const HUSKY_GIT_MISSING_MESSAGE = 'git command not found'
const ALLOWED_HUSKY_MESSAGES = new Set([
  HUSKY_SUCCESS_MESSAGE,
  HUSKY_SKIP_MESSAGE,
  HUSKY_NOT_IN_GIT_MESSAGE,
  HUSKY_GIT_MISSING_MESSAGE,
])

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

export function normalizeHuskyResult(message) {
  return message?.trim() ?? HUSKY_SUCCESS_MESSAGE
}

export function isAllowedHuskyResult(message) {
  return ALLOWED_HUSKY_MESSAGES.has(message)
}

export function installHusky() {
  const result = normalizeHuskyResult(husky(HUSKY_INSTALL_DIRECTORY))

  if (!isAllowedHuskyResult(result)) {
    throw new Error(`Husky install failed: ${result}`)
  }

  return result
}

function isExecutedDirectly() {
  const entrypoint = process.argv[1]
  if (!entrypoint) return false

  return import.meta.url === pathToFileURL(resolve(entrypoint)).href
}

function runDirectly() {
  if (!shouldInstallHusky()) return

  try {
    installHusky()
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

if (isExecutedDirectly()) {
  runDirectly()
}
