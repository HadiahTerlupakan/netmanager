type EnvShape = Record<string, string | undefined>

type Logger = {
  log: (...args: unknown[]) => void
}

type StartInternalCronOptions = {
  env?: EnvShape
  startAll: () => void
  logger?: Logger
}

export function shouldStartInternalCron(env: EnvShape = process.env): boolean {
  const flag = env.ENABLE_INTERNAL_CRON?.trim().toLowerCase()

  if (flag === 'true') return true
  if (flag === 'false') return false

  return true
}

export function startInternalCronIfEnabled({
  env = process.env,
  startAll,
  logger = console,
}: StartInternalCronOptions): boolean {
  if (!shouldStartInternalCron(env)) {
    logger.log('[Cron] Internal cron disabled for this runtime')
    return false
  }

  startAll()
  return true
}
