import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { notifyAdminsAboutMobileAction } from '@/modules/notification';

// GET - List available work orders (PENDING status, not assigned)
export async function GET(request: NextRequest) {
    try {
        // Auth Check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        const payload = await verifyMobileToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const userId = payload.id as string;

        // Fetch user to get department, site and name
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { departmentId: true, siteId: true, name: true }
        });

        // Strict Filtering Logic:
        // 1. If WO has Dept, User must be in that Dept (or User is Dept-less? No, usually Users must be in Dept)
        //    Easier: WO Dept is NULL OR WO Dept == User Dept
        // 2. If WO has Site, User must be in that Site (or WO Site is NULL)
        
        const departmentFilter: any = { departmentId: null };
        if (user?.departmentId) {
            departmentFilter.departmentId = { in: [null, user.departmentId] }; // Allow null or match
        }

        const siteFilter: any = { siteId: null };
        if (user?.siteId) {
            siteFilter.siteId = { in: [null, user.siteId] }; // Allow null or match
        }

        const workOrders = await prisma.workOrders.findMany({
            where: {
                status: 'PENDING',
                assignedToId: null,
                AND: [
                    // Handle Department Match
                    user?.departmentId 
                        ? { OR: [{ departmentId: null }, { departmentId: user.departmentId }] }
                        : { departmentId: null }, // If user has no dept, can only see global

                    // Handle Site Match
                    user?.siteId 
                        ? { OR: [{ siteId: null }, { siteId: user.siteId }] }
                        : { siteId: null } // If user has no site, can only see global location
                ]
            },
            select: {
                id: true,
                workOrderNumber: true,
                title: true,
                description: true,
                type: true,
                status: true,
                priority: true,
                contactName: true,
                contactPhone: true,
                locationAddress: true,
                scheduledDate: true,
                createdAt: true,
                pelanggan: {
                    select: {
                        id: true,
                        nama: true,
                        alamat: true,
                        noTelp: true
                    }
                },
                site: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                },
                department: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: [
                { priority: 'desc' },
                { scheduledDate: 'asc' },
                { createdAt: 'desc' }
            ],
            take: 50
        });

        return NextResponse.json({
            success: true,
            data: workOrders
        });
    } catch (error) {
        console.error('Error fetching available work orders:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Take a work order (assign to self)
export async function POST(request: NextRequest) {
    try {
        // Auth Check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        const payload = await verifyMobileToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const userId = payload.id as string;
        const body = await request.json();
        const { workOrderId } = body;

        if (!workOrderId) {
            return NextResponse.json({ error: 'workOrderId is required' }, { status: 400 });
        }

        // Fetch User to check permissions
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { departmentId: true, siteId: true, name: true }
        });

        // Check if work order exists and is available
        const workOrder = await prisma.workOrders.findUnique({
            where: { id: workOrderId }
        });

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 });
        }

        if (workOrder.status !== 'PENDING') {
            return NextResponse.json({ error: 'Work order sudah tidak tersedia' }, { status: 400 });
        }

        if (workOrder.assignedToId) {
            return NextResponse.json({ error: 'Work order sudah diambil orang lain' }, { status: 400 });
        }

        // Strict Check Authorization (Site AND Department match)
        // 1. Check Department
        const isDeptValid = !workOrder.departmentId || (user?.departmentId && workOrder.departmentId === user.departmentId);
        
        // 2. Check Site
        const isSiteValid = !workOrder.siteId || (user?.siteId && workOrder.siteId === user.siteId);

        if (!isDeptValid || !isSiteValid) {
            let errorMsg = 'Anda tidak memiliki akses ke Work Order ini (';
            if (!isDeptValid) errorMsg += 'Beda Department';
            if (!isDeptValid && !isSiteValid) errorMsg += ' & ';
            if (!isSiteValid) errorMsg += 'Beda Site';
            errorMsg += ')';
             return NextResponse.json({ error: errorMsg }, { status: 403 });
        }

        // Assign work order to user
        const updatedWorkOrder = await prisma.workOrders.update({
            where: { id: workOrderId },
            data: {
                assignedToId: userId,
                status: 'ASSIGNED',
                scheduledDate: new Date(),
                scheduledTimeStart: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
            }
        });

        // System Log
        try {
            const { logger } = await import('@/lib/logger');
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'Work Order',
                userId: userId,
                details: { id: workOrderId, action: 'ASSIGN_SELF_MOBILE', status: 'ASSIGNED' }
            });
        } catch (e) {
            console.error('Logging failed', e);
        }

        // Create update log
        await prisma.workOrderUpdates.create({
            data: {
                id: randomUUID(),
                workOrderId,
                createdById: userId,
                updateType: 'STATUS_CHANGE',
                message: 'Tiket diambil via Mobile App',
                oldStatus: 'PENDING',
                newStatus: 'ASSIGNED'
            }
        });


        // Notify Admin Portal about CLAIM action
        await notifyAdminsAboutMobileAction({
            workOrderId,
            workOrderNumber: updatedWorkOrder.workOrderNumber,
            title: updatedWorkOrder.title,
            actionType: 'CLAIM',
            actionMessage: 'Mengambil/Claim tiket Work Order',
            triggeredByUserId: userId,
            triggeredByName: (user?.name as string) || (payload.name as string),
            departmentId: updatedWorkOrder.departmentId || undefined,
            siteId: updatedWorkOrder.siteId || undefined,
        });
        console.log(`[Mobile Claim] Notifying admins with triggeredByName: '${user?.name}' (DB) vs '${payload.name}' (Token)`);

        return NextResponse.json({ success: true, workOrder: updatedWorkOrder });
    } catch (error) {
        console.error('Error taking work order:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
