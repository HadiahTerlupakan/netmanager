import { prisma } from "@/lib/prisma"
import type { WorkOrder, SupportTicket, WorkOrderAttachment } from "@prisma/client"
import { WorkOrderStatus, TicketStatus } from "@prisma/client"
import { format } from "date-fns"
import { id } from "date-fns/locale"

export async function syncWoStatusToTicket(workOrderId: string, status: WorkOrderStatus) {
    console.log(`[SyncService] Syncing WO ${workOrderId} status ${status}`)
    try {
        const workOrder = await prisma.workOrder.findUnique({
            where: { id: workOrderId },
            include: {
                ticket: true,
                attachments: true
            }
        }) as (WorkOrder & {
            ticket: SupportTicket | null,
            attachments: WorkOrderAttachment[]
        }) | null;

        if (!workOrder) {
            console.log(`[SyncService] WO not found`)
            return
        }

        if (!workOrder.ticketId) {
            console.log(`[SyncService] WO ${workOrder.workOrderNumber} has no ticketId`)
            return
        }

        console.log(`[SyncService] Found linked Ticket ${workOrder.ticketId}`)

        if (status === "IN_PROGRESS") {
            // Update Ticket to IN_PROGRESS
            console.log(`[SyncService] Updating ticket to IN_PROGRESS`)
            await prisma.supportTicket.update({
                where: { id: workOrder.ticketId },
                data: { status: TicketStatus.IN_PROGRESS }
            })
        } else if (status === "COMPLETED") {
            // Update Ticket to RESOLVED (Sudah Dikerjakan)
            console.log(`[SyncService] Updating ticket to RESOLVED and sending report`)
            await prisma.supportTicket.update({
                where: { id: workOrder.ticketId },
                data: { status: TicketStatus.RESOLVED }
            })

            // Send Completion Report
            const completionPhotos = workOrder.attachments.filter(a => a.caption?.startsWith('[COMPLETION]'))

            let message = `**Laporan Pekerjaan Selesai**\n\n` +
                `Work Order #${workOrder.workOrderNumber} telah diselesaikan.\n` +
                `Judul: ${workOrder.title}\n` +
                `Waktu Selesai: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}\n\n` +
                `**Keterangan:**\n${workOrder.resolutionNotes || workOrder.description || '-'}\n`

            if (completionPhotos.length > 0) {
                message += `\n**Bukti Foto:**\n`
            }

            const attachUrls = completionPhotos.map(p => p.filePath)

            await prisma.ticketReply.create({
                data: {
                    ticketId: workOrder.ticketId,
                    message: message,
                    isFromAdmin: true,
                    attachments: attachUrls.length > 0 ? JSON.stringify(attachUrls) : undefined,
                    senderId: workOrder.assignedToId
                }
            })
            console.log(`[SyncService] Report sent successfully`)
        }

    } catch (error) {
        console.error("Error syncing WO to Ticket:", error)
    }
}

export async function closeWoOnTicketClose(ticketId: string) {
    console.log(`[SyncService] Closing WOs for Ticket ${ticketId}`)
    try {
        const wos = await prisma.workOrder.findMany({
            where: { ticketId: ticketId }
        })

        for (const wo of wos) {
            if (wo.status === "PENDING") {
                // WO Belum Diambil -> BATAL
                console.log(`[SyncService] WO ${wo.workOrderNumber} is PENDING -> CANCELLED`)
                await prisma.workOrder.update({
                    where: { id: wo.id },
                    data: {
                        status: "CANCELLED",
                        closedAt: new Date(),
                        resolutionNotes: "Tiket ditutup sebelum WO diambil"
                    }
                })
            } else if (wo.status === "ASSIGNED" || wo.status === "IN_PROGRESS" || wo.status === "ON_HOLD") {
                // WO Sudah Diambil tapi belum selesai -> CLOSED tanpa kirim laporan
                console.log(`[SyncService] WO ${wo.workOrderNumber} is ${wo.status} -> CLOSED (No Report)`)
                await prisma.workOrder.update({
                    where: { id: wo.id },
                    data: {
                        status: "CLOSED",
                        completedAt: new Date(),
                        verifiedAt: new Date(),
                        closedAt: new Date(),
                        resolutionNotes: "Tiket ditutup manual oleh Admin"
                    }
                })
            } else if (wo.status === "COMPLETED" || wo.status === "VERIFIED") {
                // WO Sudah Selesai -> Archive (CLOSED)
                console.log(`[SyncService] WO ${wo.workOrderNumber} is ${wo.status} -> CLOSED (Archive)`)
                await prisma.workOrder.update({
                    where: { id: wo.id },
                    data: {
                        status: "CLOSED",
                        verifiedAt: wo.verifiedAt || new Date(),
                        closedAt: new Date()
                    }
                })
            }
        }
    } catch (error) {
        console.error("Error closing WOs for ticket:", error)
    }
}
