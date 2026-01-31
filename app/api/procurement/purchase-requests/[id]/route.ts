import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { ProcurementService } from '@/modules/procurement'

const procurementService = new ProcurementService()

/**
 * GET /api/procurement/purchase-requests/[id]
 * Get Purchase Request by ID
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await hasPermission('purchase_orders:read'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params

        const pr = await prisma.purchaseRequest.findUnique({
            where: { id },
            include: {
                requester: { select: { name: true, email: true } },
                gudang: { select: { nama: true, kode: true } },
                items: {
                    include: {
                        barang: { select: { nama: true, kode: true, satuan: true } }
                    }
                },
                purchaseOrder: { select: { id: true, poNumber: true, status: true } }
            }
        })

        if (!pr) {
            return NextResponse.json({ error: 'Purchase Request not found' }, { status: 404 })
        }

        return NextResponse.json(pr)
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error'
        console.error('Error fetching purchase request:', error)
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

/**
 * PATCH /api/procurement/purchase-requests/[id]
 * Update Purchase Request status (approve/reject)
 * If approved, automatically generates a Purchase Order
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const startTime = Date.now()
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await hasPermission('purchase_orders:update'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const body = await req.json()
        const { action, catatan } = body

        // Validate action
        if (!['APPROVE', 'REJECT'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action. Must be APPROVE or REJECT' }, { status: 400 })
        }

        // Find existing PR with items and barang details
        const existing = await prisma.purchaseRequest.findUnique({
            where: { id },
            include: { 
                items: {
                    include: {
                        barang: { select: { id: true, nama: true, supplierId: true } }
                    }
                }
            }
        })

        if (!existing) {
            return NextResponse.json({ error: 'Purchase Request not found' }, { status: 404 })
        }

        if (existing.status !== 'DRAFT') {
            return NextResponse.json({ error: `Cannot ${action.toLowerCase()} PR with status ${existing.status}` }, { status: 400 })
        }

        // Handle REJECT
        if (action === 'REJECT') {
            const updated = await prisma.purchaseRequest.update({
                where: { id },
                data: {
                    status: 'REJECTED',
                    catatanApproval: catatan || null,
                    approvedAt: new Date(),
                    approvedBy: session.user.id as string
                },
                include: {
                    requester: { select: { name: true } },
                    gudang: { select: { nama: true } }
                }
            })

            await logger.logActivity({
                userId: session.user.id as string,
                action: 'REJECT PurchaseRequest',
                subject: existing.nomorRequest,
                details: {
                    id,
                    previousStatus: existing.status,
                    newStatus: 'REJECTED',
                    catatan
                }
            })

            return NextResponse.json(updated)
        }

        // Handle APPROVE - First update PR status to APPROVED
        await prisma.purchaseRequest.update({
            where: { id },
            data: {
                status: 'APPROVED',
                catatanApproval: catatan || null,
                approvedAt: new Date(),
                approvedBy: session.user.id as string
            }
        })

        // Try to auto-generate PO
        let generatedPO = null
        let poError = null

        try {
            // Auto-generate PO regardless of supplier presence
            const pos = await procurementService.generatePOFromPRs([id], session.user.id as string)
            if (pos && pos.length > 0) {
                generatedPO = pos[0]
            }
        } catch (error: unknown) {
            poError = error instanceof Error ? error.message : 'Gagal auto-generate PO'
            console.error('Auto-generate PO error:', error)
        }

        // Log activity
        await logger.logActivity({
            userId: session.user.id as string,
            action: 'APPROVE PurchaseRequest',
            subject: existing.nomorRequest,
            details: {
                id,
                previousStatus: existing.status,
                newStatus: generatedPO ? 'ORDERED' : 'APPROVED',
                catatan,
                generatedPO: generatedPO?.poNumber || null,
                poError
            }
        })

        logger.apiRequest('PATCH', `/api/procurement/purchase-requests/${id}`, 200, Date.now() - startTime, {
            userId: session.user.id,
            action,
            generatedPO: generatedPO?.poNumber
        })

        // Fetch updated PR
        const updated = await prisma.purchaseRequest.findUnique({
            where: { id },
            include: {
                requester: { select: { name: true } },
                gudang: { select: { nama: true } },
                purchaseOrder: { select: { id: true, poNumber: true, status: true } }
            }
        })

        return NextResponse.json({
            ...updated,
            _autoGeneratedPO: generatedPO ? {
                id: generatedPO.id,
                poNumber: generatedPO.poNumber
            } : null,
            _poError: poError
        })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error'
        logger.error('Error updating purchase request', error instanceof Error ? error : new Error(errorMessage), {
            path: '/api/procurement/purchase-requests/[id]',
            method: 'PATCH'
        })
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

