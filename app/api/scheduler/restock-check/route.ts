import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { createNotification } from '@/modules/notification/services/NotificationService'
import { EmailService } from '@/modules/notification/services/email-service'

/**
 * POST /api/scheduler/restock-check
 * Protected by CRON_SECRET
 * Automatically triggered by external cron job
 */
export async function POST(req: NextRequest) {
  const _startTime = Date.now()

  // 1. Authorization Check
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const dbStart = Date.now()

    // 2. Fetch Active Settings
    const settings = await prisma.restockSettings.findMany({
      where: { isActive: true },
      include: {
        barang: {
          select: {
            id: true,
            kode: true,
            nama: true,
            satuan: true
          }
        },
        gudang: {
          select: {
            id: true,
            kode: true,
            nama: true
          }
        }
      }
    })

    const newAlerts = []
    let notificationsSent = 0
    // Instantiate Email Service
    const emailService = new EmailService(prisma)

    // 3. Iterate and Check Stock
    for (const setting of settings) {
      const currentStock = await prisma.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: setting.barangId,
            gudangId: setting.gudangId
          }
        }
      })

      if (currentStock) {
        let shouldAlert = false
        let alertType = 'RESTOCK_NEEDED'
        let urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'
        let message = ''

        if (currentStock.stok === 0) {
          shouldAlert = true
          alertType = 'STOCK_OUT'
          urgency = 'CRITICAL'
          message = `STOK HABIS! ${setting.barang.nama} di ${setting.gudang.nama} kosong`
        } else if (currentStock.stok <= setting.minStok) {
          shouldAlert = true
          alertType = 'LOW_STOCK'
          urgency = currentStock.stok <= (setting.minStok * 0.5) ? 'HIGH' : 'MEDIUM'
          message = `Stok rendah! ${setting.barang.nama} di ${setting.gudang.nama} tersisa ${currentStock.stok} ${setting.barang.satuan} (min: ${setting.minStok})`
        } else if (currentStock.stok > setting.maxStok) {
          shouldAlert = true
          alertType = 'OVERSTOCK'
          urgency = 'LOW'
          message = `Stok berlebih! ${setting.barang.nama} di ${setting.gudang.nama} sebanyak ${currentStock.stok} ${setting.barang.satuan} (max: ${setting.maxStok})`
        }

        if (shouldAlert) {
          // Check for existing unresolved alert
          const existingAlert = await prisma.restockAlerts.findFirst({
            where: {
              barangId: setting.barangId,
              gudangId: setting.gudangId,
              alertType: alertType as 'RESTOCK_NEEDED' | 'STOCK_OUT' | 'LOW_STOCK' | 'OVERSTOCK',
              isResolved: false
            }
          })

          if (!existingAlert) {
            const recommendedOrder = Math.max(0, setting.maxStok - currentStock.stok)
            const alertId = crypto.randomUUID()

            // Create Alert in DB
            const newAlert = await prisma.restockAlerts.create({
              data: {
                id: alertId,
                barangId: setting.barangId,
                gudangId: setting.gudangId,
                alertType: alertType as 'RESTOCK_NEEDED' | 'STOCK_OUT' | 'LOW_STOCK' | 'OVERSTOCK',
                currentStok: currentStock.stok,
                minStok: setting.minStok,
                recommendedOrder,
                urgency,
                message
              }
            })
            newAlerts.push(newAlert)

            // Critical/High Urgency -> Send Notification
            if (urgency === 'CRITICAL' || urgency === 'HIGH') {
              // 1. System Notification (In-App + Push via Socket)
               await createNotification({
                type: 'ALERT',
                priority: urgency === 'CRITICAL' ? 'HIGH' : 'NORMAL',
                title: urgency === 'CRITICAL' ? '🚨 STOK HABIS' : '⚠️ Stok Menipis',
                message: message,
                // userId: undefined, // Broadcast via notifyAdmins in service
                sourceType: 'INVENTORY',
                link: '/admin/inventory/restock',
                sourceId: alertId
              })

              notificationsSent++

              // 2. Email Notification (for CRITICAL only)
              if (urgency === 'CRITICAL') {
                  // Find recipients with permission
                  const recipients = await prisma.user.findMany({
                      where: {
                          isActive: true,

                          role: {
                              permission: {
                                  some: {
                                      resource: 'restock',
                                      action: 'read'
                                  }
                              }
                          }
                      },
                      select: { email: true }
                  })

                  for (const recipient of recipients) {
                      if (recipient.email) {
                          await emailService.sendEmail({
                              to: recipient.email,
                              subject: `[CRITICAL] Stock Alert: ${setting.barang.nama}`,
                              html: `
                                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                                    <h2 style="color: #dc2626;">🚨 Stok Habis: ${setting.barang.nama}</h2>
                                    <p>Barang <strong>${setting.barang.nama}</strong> di gudang <strong>${setting.gudang.nama}</strong> telah habis.</p>
                                    <div style="background-color: #f3f4f6; padding: 10px; border-radius: 4px; margin: 15px 0;">
                                        <p style="margin: 5px 0;"><strong>Current Stock:</strong> ${currentStock.stok} ${setting.barang.satuan}</p>
                                        <p style="margin: 5px 0;"><strong>Min Stock:</strong> ${setting.minStok}</p>
                                        <p style="margin: 5px 0;"><strong>Recommended Order:</strong> ${recommendedOrder}</p>
                                    </div>
                                    <p>Mohon segera lakukan restock atau buat Purchase Request melalui dashboard.</p>
                                    <a href="${process.env.NEXTAUTH_URL}/admin/inventory/restock" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Buka Dashboard Restock</a>
                                </div>
                              `
                          }).catch(err => logger.error(`Failed to send email to ${recipient.email}`, err))
                      }
                  }
              }
            }
          }
        }
      }
    }

    logger.dbOperation('transaction', 'Scheduler+RestockCheck', Date.now() - dbStart)

    return NextResponse.json({
      success: true,
      processed: settings.length,
      newAlerts: newAlerts.length,
      notificationsSent
    })

  } catch (error: unknown) {
    logger.error('Error in scheduler restock check', error as Error, {
      path: '/api/scheduler/restock-check',
      method: 'POST',
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
