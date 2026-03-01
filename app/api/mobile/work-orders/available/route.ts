import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { prismaMitra } from '@/lib/prisma-mitra';
import { randomUUID } from 'crypto';
import { notifyAdminsAboutMobileAction } from '@/modules/notification';
import { logActivitySafe } from '@/lib/logger';

// GET - List available work orders (PENDING status, not assigned)
export async function GET(request: NextRequest) {
    try {
        // Auth Check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Format token tidak valid' }, { status: 401 });
        }

        const payload = await verifyMobileToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
        }

        const userId = payload.id as string;

        // Fetch user to get department, site(s) and name
        // Multi-site: Include userSites
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                departmentId: true,
                siteId: true,
                name: true,
                userSites: {
                    select: { siteId: true }
                }
            }
        });

        // Collect user's site IDs (multi-site + legacy)
        const userSiteIds: string[] = [];
        if (user?.userSites && user.userSites.length > 0) {
            userSiteIds.push(...user.userSites.map(us => us.siteId));
        } else if (user?.siteId) {
            userSiteIds.push(user.siteId);
        }

        const currentViewerId = payload.role === 'MITRA' ? ((payload.sub || payload.id) as string) : userId;

        // Handle permissions differently for Mitra vs Internal User
        let whereClause: Record<string, unknown> = {
            status: 'PENDING',
            assignedToId: null,
            assignedMitraId: null,
            // Warranty SLA Lock: 
            // - If not a warranty ticket, show it.
            // - If it is a warranty ticket, only show if SLA has expired OR if the current user is the owner.
            OR: [
                { isWarranty: false },
                {
                    isWarranty: true,
                    OR: [
                        { warrantySla: { lt: new Date() } },
                        { warrantyOwnerId: currentViewerId }
                    ]
                }
            ]
        };

        if (payload.role === 'MITRA') {
            const mitraId = currentViewerId;
            // Fetch Mitra's true siteId from DB in case it's not in token
            const mitra = await prismaMitra.mitra.findUnique({
                where: { id: mitraId },
                select: { siteId: true }
            });
            const mitraSiteId = mitra?.siteId || payload.siteId;

            whereClause = {
                ...whereClause,
                AND: [
                    mitraSiteId
                        ? { OR: [{ siteId: null }, { siteId: mitraSiteId }] }
                        : { siteId: null }
                ]
            };
        } else {
            // Original logic for internal users
            const departmentFilter: Record<string, unknown> = { departmentId: null };
            if (user?.departmentId) {
                departmentFilter.departmentId = { in: [null, user.departmentId] }; // Allow null or match
            }

            whereClause = {
                ...whereClause,
                AND: [
                    // Handle Department Match
                    user?.departmentId
                        ? { OR: [{ departmentId: null }, { departmentId: user.departmentId }] }
                        : { departmentId: null }, // If user has no dept, can only see global

                    // Handle Site Match (Multi-site support)
                    userSiteIds.length > 0
                        ? { OR: [{ siteId: null }, { siteId: { in: userSiteIds } }] }
                        : { siteId: null } // If user has no sites, can only see global location
                ]
            };
        }

        const workOrders = await prisma.workOrders.findMany({
            where: whereClause,
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
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
    }
}

// POST - Take a work order (assign to self)
export async function POST(request: NextRequest) {
    try {
        // Auth Check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Format token tidak valid' }, { status: 401 });
        }

        const payload = await verifyMobileToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
        }

        const userId = payload.id as string;
        const body = await request.json();
        const { workOrderId } = body;

        if (!workOrderId) {
            return NextResponse.json({ error: 'workOrderId wajib diisi' }, { status: 400 });
        }

        // Fetch User to check permissions (Multi-site support)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                departmentId: true,
                siteId: true,
                name: true,
                userSites: {
                    select: { siteId: true }
                }
            }
        });

        // Collect user's site IDs (multi-site + legacy)
        const userSiteIds: string[] = [];
        if (user?.userSites && user.userSites.length > 0) {
            userSiteIds.push(...user.userSites.map(us => us.siteId));
        } else if (user?.siteId) {
            userSiteIds.push(user.siteId);
        }

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

        if (workOrder.assignedToId || workOrder.assignedMitraId) {
            return NextResponse.json({ error: 'Work order sudah diambil orang lain' }, { status: 400 });
        }

        let updatedWorkOrder;
        let triggeredByName = 'Unknown';

        if (payload.role === 'MITRA') {
            const mitraId = (payload.sub || payload.id) as string;
            // Fetch Mitra for site authorization
            const mitra = await prismaMitra.mitra.findUnique({
                where: { id: mitraId },
                select: { name: true, siteId: true }
            });
            const mitraSiteId = mitra?.siteId || payload.siteId;
            triggeredByName = (mitra?.name as string) || (payload.name as string) || 'Unknown Mitra';

            // Check Site
            const isSiteValid = !workOrder.siteId || mitraSiteId === workOrder.siteId;
            if (!isSiteValid) {
                return NextResponse.json({ error: 'Anda tidak memiliki akses ke Work Order ini (Beda Site)' }, { status: 403 });
            }

            // Assign work order to Mitra
            updatedWorkOrder = await prisma.workOrders.update({
                where: { id: workOrderId },
                data: {
                    assignedMitraId: mitraId,
                    status: 'ASSIGNED',
                    scheduledDate: new Date(),
                    scheduledTimeStart: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
                }
            });

            // Also log to WorkOrderAssignments for consistency if needed by other logic
            await prisma.workOrderAssignments.create({
                data: {
                    id: randomUUID(),
                    workOrderId,
                    mitraId: mitraId,
                    role: 'TEKNISI',
                    status: 'PENDING'
                }
            });

        } else {
            // Strict Check Authorization (Site AND Department match for Internal)
            // 1. Check Department
            const isDeptValid = !workOrder.departmentId || (user?.departmentId && workOrder.departmentId === user.departmentId);

            // 2. Check Site (Multi-site: check against userSiteIds array)
            const isSiteValid = !workOrder.siteId || userSiteIds.includes(workOrder.siteId);

            if (!isDeptValid || !isSiteValid) {
                let errorMsg = 'Anda tidak memiliki akses ke Work Order ini (';
                if (!isDeptValid) errorMsg += 'Beda Department';
                if (!isDeptValid && !isSiteValid) errorMsg += ' & ';
                if (!isSiteValid) errorMsg += 'Beda Site';
                errorMsg += ')';
                return NextResponse.json({ error: errorMsg }, { status: 403 });
            }

            triggeredByName = (user?.name as string) || (payload.name as string) || 'Unknown User';

            // Assign work order to Internal user
            updatedWorkOrder = await prisma.workOrders.update({
                where: { id: workOrderId },
                data: {
                    assignedToId: userId,
                    status: 'ASSIGNED',
                    scheduledDate: new Date(),
                    scheduledTimeStart: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
                }
            });

            await prisma.workOrderAssignments.create({
                data: {
                    id: randomUUID(),
                    workOrderId,
                    userId,
                    role: 'TEKNISI',
                    status: 'PENDING'
                }
            });
        }

        // System Log
        logActivitySafe({
            action: 'UPDATE',
            subject: 'Work Order',
            userId: payload.role === 'MITRA' ? null : userId,
            details: { id: workOrderId, action: 'ASSIGN_SELF_MOBILE', status: 'ASSIGNED', role: payload.role, triggeredByName }
        });

        // Create update log
        await prisma.workOrderUpdates.create({
            data: {
                id: randomUUID(),
                workOrderId,
                createdById: payload.role === 'MITRA' ? null : userId,
                updateType: 'STATUS_CHANGE',
                message: payload.role === 'MITRA' ? `Tiket diambil via Mobile App oleh Mitra Teknisi (${triggeredByName})` : 'Tiket diambil via Mobile App',
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
            triggeredByName: triggeredByName,
            ...(updatedWorkOrder.departmentId && { departmentId: updatedWorkOrder.departmentId }),
            ...(updatedWorkOrder.siteId && { siteId: updatedWorkOrder.siteId }),
        });
        // console.log(`[Mobile Claim] Notifying admins with triggeredByName: '${user?.name}' (DB) vs '${payload.name}' (Token)`);

        return NextResponse.json({ success: true, workOrder: updatedWorkOrder });
    } catch (error) {
        console.error('Error taking work order:', error);
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
    }
}
