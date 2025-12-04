/**
 * Scheduler untuk auto-generate tagihan bulanan
 * Menggunakan node-cron untuk menjalankan generate tagihan secara berkala
 */

import cron from 'node-cron'
import { generateTagihanBulanan, generateTagihanOtomatis } from '@/lib/services/tagihan-service'
import { getTimezone } from '@/lib/utils/get-timezone'

let generateJob: ReturnType<typeof cron.schedule> | null = null

/**
 * Start scheduler untuk auto-generate tagihan bulanan
 * Default: setiap tanggal 1 jam 00:00 (setiap bulan)
 * @param cronExpression - Cron expression (default: '0 0 1 * *' = setiap tanggal 1 jam 00:00)
 */
export async function startTagihanGeneratorScheduler(
  cronExpression: string = '0 0 1 * *',
): Promise<void> {
  if (generateJob) {
    console.log(
      '[Tagihan-Generator-Scheduler] Scheduler already running, stopping previous one...',
    )
    stopTagihanGeneratorScheduler()
  }

  // Ambil timezone dari settings
  const timezone = await getTimezone()

  console.log(
    `[Tagihan-Generator-Scheduler] Starting tagihan generator scheduler with cron: ${cronExpression}, timezone: ${timezone}`,
  )

  generateJob = cron.schedule(
    cronExpression,
    async () => {
      try {
        const now = new Date()
        const periodeBulan = now.getMonth() + 1 // 1-12
        const periodeTahun = now.getFullYear()

        console.log(
          `[Tagihan-Generator-Scheduler] [${now.toISOString()}] Running scheduled tagihan generation for ${periodeBulan}/${periodeTahun}...`,
        )

        const result = await generateTagihanBulanan(periodeBulan, periodeTahun)

        console.log(
          `[Tagihan-Generator-Scheduler] [${now.toISOString()}] Scheduled generation completed. Success: ${result.success}, Failed: ${result.failed}`,
        )

        if (result.errors.length > 0) {
          console.warn(
            `[Tagihan-Generator-Scheduler] Errors encountered:`,
            result.errors,
          )
        }
      } catch (error: any) {
        console.error(
          `[Tagihan-Generator-Scheduler] Error in scheduled generation:`,
          error?.message || error,
        )
      }
    },
    {
      scheduled: true,
      timezone: timezone,
    } as any,
  )

  console.log(
    '[Tagihan-Generator-Scheduler] Tagihan generator scheduler started successfully',
  )
}

let autoInvoiceJob: ReturnType<typeof cron.schedule> | null = null

/**
 * Start scheduler untuk auto-generate invoice berdasarkan pengaturan (X hari sebelum jatuh tempo)
 * Default: setiap hari jam 00:00
 * @param cronExpression - Cron expression (default: '0 0 * * *' = setiap hari jam 00:00)
 */
export async function startAutoInvoiceScheduler(
  cronExpression: string = '0 0 * * *',
): Promise<void> {
  if (autoInvoiceJob) {
    console.log(
      '[Auto-Invoice-Scheduler] Scheduler already running, stopping previous one...',
    )
    stopAutoInvoiceScheduler()
  }

  // Ambil timezone dari settings
  const timezone = await getTimezone()

  console.log(
    `[Auto-Invoice-Scheduler] Starting auto invoice scheduler with cron: ${cronExpression}, timezone: ${timezone}`,
  )

  autoInvoiceJob = cron.schedule(
    cronExpression,
    async () => {
      try {
        const now = new Date()
        console.log(
          `[Auto-Invoice-Scheduler] [${now.toISOString()}] Running scheduled auto invoice generation...`,
        )

        const result = await generateTagihanOtomatis()

        console.log(
          `[Auto-Invoice-Scheduler] [${now.toISOString()}] Scheduled auto invoice generation completed. Success: ${result.success}, Failed: ${result.failed}`,
        )

        if (result.errors.length > 0) {
          console.warn(
            `[Auto-Invoice-Scheduler] Errors encountered:`,
            result.errors,
          )
        }
      } catch (error: any) {
        console.error(
          `[Auto-Invoice-Scheduler] Error in scheduled auto invoice generation:`,
          error?.message || error,
        )
      }
    },
    {
      scheduled: true,
      timezone: timezone,
    } as any,
  )

  console.log(
    '[Auto-Invoice-Scheduler] Auto invoice scheduler started successfully',
  )
}

/**
 * Stop auto invoice scheduler
 */
export function stopAutoInvoiceScheduler(): void {
  if (autoInvoiceJob) {
    autoInvoiceJob.stop()
    autoInvoiceJob = null
    console.log('[Auto-Invoice-Scheduler] Auto invoice scheduler stopped')
  }
}

/**
 * Check if auto invoice scheduler is running
 */
export function isAutoInvoiceSchedulerRunning(): boolean {
  return autoInvoiceJob !== null
}

/**
 * Stop scheduler
 */
export function stopTagihanGeneratorScheduler(): void {
  if (generateJob) {
    generateJob.stop()
    generateJob = null
    console.log('[Tagihan-Generator-Scheduler] Tagihan generator scheduler stopped')
  }
}

/**
 * Check if scheduler is running
 */
export function isTagihanGeneratorSchedulerRunning(): boolean {
  return generateJob !== null
}


