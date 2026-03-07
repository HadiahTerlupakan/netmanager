import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { prismaMitra } from '@/lib/prisma-mitra';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { convertAndSaveImage } from '@/lib/utils/image-upload';
import { format } from 'date-fns';
import { notifyAdminsAboutMobileAction } from '@/modules/notification';
import { logger } from '@/lib/logger';

// Valid status transitions
const _VALID_TRANSITIONS: Record<string, string[]> = {
    'PENDING': ['ASSIGNED'],
    'ASSIGNED': ['IN_PROGRESS', 'CANCELLED'],
    'IN_PROGRESS': ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
    'ON_HOLD': ['IN_PROGRESS', 'CANCELLED'],
    'COMPLETED': ['VERIFIED', 'IN_PROGRESS'], // Allow re-open
    'VERIFIED': ['CLOSED'],
    'CLOSED': [],
    'CANCELLED': [],
};

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        // ============================================
        // 1. AUTHENTICATION CHECK
        // ============================================
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
        const workOrderId = params.id;
        const repository = new WorkOrderRepository(prisma);

        // Fetch User to get Name (for notifications)
        // NOTE: Mitra users do NOT exist in the User table, so user will be null
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true }
        });

        // For DB operations with FK to User table (e.g. work_order_updates.createdById),
        // use null for Mitra users since their ID is not in the User table
        const userIdForDb = user ? userId : undefined;

        // ============================================
        // 2. FETCH WORK ORDER & AUTHORIZATION CHECK
        // ============================================
        const workOrder = await prisma.workOrders.findUnique({
            where: { id: workOrderId },
            include: {
                ticket: { select: { ticketNumber: true } },
                assignments: { select: { userId: true, status: true } },
                department: { select: { id: true, name: true } },
                site: { select: { id: true, name: true } },
            }
        });

        if (!workOrder) {
            return NextResponse.json({ error: 'Work Order tidak ditemukan' }, { status: 404 });
        }

        // Check if user is authorized to update this WO
        const isAssignedTo = workOrder.assignedToId === userId;
        const isAssignedMitra = workOrder.assignedMitraId === userId;
        const isAssignmentMember = workOrder.assignments.some(
            (a) => a.userId === userId && a.status !== 'REJECTED'
        );
        const isCreator = workOrder.createdById === userId;

        if (!isAssignedTo && !isAssignedMitra && !isAssignmentMember && !isCreator) {
            return NextResponse.json(
                { error: 'Anda tidak memiliki akses untuk mengubah Work Order ini' },
                { status: 403 }
            );
        }

        // ============================================
        // 3. PARSE REQUEST (JSON or FormData)
        // ============================================
        let action: string | undefined;
        let notes: string | undefined;
        let photo: File | undefined;
        let photos: File[] = [];
        let latitude: string | number | undefined;
        let longitude: string | number | undefined;
        let locationName: string | undefined;
        let photoUrl: string | undefined;
        let photoUrls: string[] | undefined;
        let timestampStr: string | undefined;

        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            const body = await request.json();
            action = body.action;
            notes = body.notes;
            latitude = body.latitude;
            longitude = body.longitude;
            locationName = body.locationName;
            photoUrl = body.photoUrl;
            photoUrls = body.photoUrls;
            timestampStr = body.timestamp;
        } else {
            // Parse FormData ONCE and extract all fields including photos
            const formData = await request.formData();
            action = formData.get('action') as string;
            notes = formData.get('notes') as string;
            photo = formData.get('photo') as File | null || undefined;
            latitude = formData.get('latitude') as string;
            longitude = formData.get('longitude') as string;
            locationName = formData.get('locationName') as string;
            timestampStr = formData.get('timestamp') as string;

            // Extract multiple photos for COMPLETE action
            const photosFromForm = formData.getAll('photos') as File[];
            photos = photosFromForm.filter(p => p instanceof File);

            // Also include single photo if provided separately
            if (photo instanceof File && !photos.some(p => p.name === photo!.name)) {
                photos.push(photo);
            }
        }

        // ============================================
        // 4. BUILD LOCATION STRING
        // ============================================
        let locationStr = 'Loc: Unknown';
        const coords = (latitude && longitude)
            ? `(${String(latitude).slice(0, 8)}, ${String(longitude).slice(0, 8)})`
            : '';

        if (locationName && coords) {
            locationStr = `${locationName} ${coords}`;
        } else if (locationName) {
            locationStr = locationName;
        } else if (coords) {
            locationStr = `Loc: ${coords}`;
        }

        const timestamp = timestampStr ? new Date(timestampStr) : undefined;
        const ticketNumber = workOrder.ticket?.ticketNumber || workOrder.workOrderNumber || workOrderId;

        // ============================================
        // 5. VALIDATE ACTION
        // ============================================
        if (!action) {
            return NextResponse.json({ error: 'Action wajib diisi' }, { status: 400 });
        }

        // ============================================
        // 6. HANDLE ACTIONS
        // ============================================
        if (action === 'START') {
            // Validate status transition: only ASSIGNED can be started
            if (!['ASSIGNED', 'ON_HOLD'].includes(workOrder.status)) {
                return NextResponse.json(
                    { error: `Tidak dapat memulai Work Order dengan status: ${workOrder.status}. Harus berstatus ASSIGNED atau ON_HOLD.` },
                    { status: 400 }
                );
            }

            await repository.start(workOrderId, userIdForDb, timestamp);

            if (notes) {
                await repository.addUpdate({
                    workOrderId,
                    updateType: 'NOTE',
                    message: notes,
                    createdById: userIdForDb
                });
            }

            // Notify Admins
            await notifyAdminsAboutMobileAction({
                workOrderId,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                actionType: 'START',
                actionMessage: 'Memulai pengerjaan Work Order',
                triggeredByUserId: userId,
                triggeredByName: (user?.name as string) || (payload.name as string) || 'Unknown',
                ...(workOrder.departmentId && { departmentId: workOrder.departmentId }),
                ...(workOrder.siteId && { siteId: workOrder.siteId }),
            });



            // System Log
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'WorkOrder',
                userId,
                details: { id: workOrderId, action: 'START' }
            });

            return NextResponse.json({ success: true, message: 'Work Order Started' });

        } else if (action === 'CLAIM') {
            // Validate status: must be PENDING
            if (workOrder.status !== 'PENDING') {
                return NextResponse.json(
                    { error: `Tidak dapat mengklaim Work Order dengan status: ${workOrder.status}. Harus berstatus PENDING.` },
                    { status: 400 }
                );
            }

            // Assign to self
            await repository.assign(workOrderId, userId, 'Lead', userId);



            // System Log
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'WorkOrder',
                userId,
                details: { id: workOrderId, action: 'CLAIM' }
            });

            return NextResponse.json({ success: true, message: 'Work Order Claimed' });

        } else if (action === 'COMPLETE') {
            // Validate status transition
            if (workOrder.status !== 'IN_PROGRESS') {
                return NextResponse.json(
                    { error: `Tidak dapat menyelesaikan Work Order dengan status: ${workOrder.status}. Harus berstatus IN_PROGRESS.` },
                    { status: 400 }
                );
            }

            // Handle photos from JSON (already uploaded URLs)
            if (photoUrls && Array.isArray(photoUrls) && photoUrls.length > 0) {
                for (let i = 0; i < photoUrls.length; i++) {
                    const url = photoUrls[i];
                    if (!url) continue;
                    await repository.addAttachment(
                        workOrderId,
                        `photo_${i}.jpg`,
                        url,
                        0,
                        'image/jpeg',
                        `[COMPLETION] Bukti Penyelesaian ${i + 1}`,
                        userIdForDb
                    );
                }
            }
            // Handle photos from FormData (need processing)
            else if (photos.length > 0) {
                const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

                for (let i = 0; i < photos.length; i++) {
                    const p = photos[i];
                    if (!(p instanceof File)) continue;

                    const watermarkLines = [
                        format(new Date(), 'dd MMM yyyy HH:mm'),
                        `#${ticketNumber}`,
                        `Tech: ${user?.name || 'Unknown'}`,
                        locationStr,
                        `[COMPLETED] ${i + 1}/${photos.length}`
                    ];

                    const dateStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
                    const uploadDir = `public/uploads/workorders/${dateStr}`;
                    const fileName = `${workOrderId}_complete_${Date.now()}_${i}`;

                    const filePath = await convertAndSaveImage(
                        p,
                        uploadDir,
                        fileName,
                        'workorder-completion',
                        workOrderId,
                        watermarkLines
                    );

                    await repository.addAttachment(
                        workOrderId,
                        p.name,
                        filePath,
                        p.size,
                        p.type,
                        `[COMPLETION] Bukti Penyelesaian ${i + 1}`,
                        userIdForDb
                    );
                }
            }

            await repository.complete(workOrderId, notes, userIdForDb, timestamp);

            // ==========================================
            // MITRA COMMISSION: Auto-add earning for MITRA_TEKNISI
            // ==========================================
            try {
                const mitra = await prismaMitra.mitra.findUnique({
                    where: { id: userId },
                    select: { mitraType: true, mitraRateWoPsb: true, mitraRateWoMaintenance: true },
                });
                if (mitra?.mitraType === 'MITRA_TEKNISI') {
                    const { getMitraWalletService } = await import('@/modules/mitra');
                    const walletService = getMitraWalletService();

                    // --- WARRANTY & PENALTY LOGIC ---
                    if (workOrder.isWarranty && workOrder.warrantyOwnerId) {
                        if (workOrder.warrantyOwnerId === userId) {
                            // Scenario A: Original owner fixes it themselves within or outside SLA
                            // Commission is Rp 0. Do not deduct penalty.
                            await walletService.addEarning(
                                userId,
                                0,
                                `Pengerjaan Garansi Mandiri #${ticketNumber}`,
                                workOrderId,
                                'WORK_ORDER'
                            );
                            logger.info(`[Warranty] Mitra ${userId} completed their own warranty ticket ${workOrderId} with Rp 0 commission.`);
                        } else {
                            // Scenario B: Scavenger fixes the ticket
                            // 1. Scavenger gets normal commission
                            let rate = 0;
                            if (workOrder.type === 'INSTALLATION' && mitra.mitraRateWoPsb) rate = mitra.mitraRateWoPsb;
                            else if (mitra.mitraRateWoMaintenance) rate = mitra.mitraRateWoMaintenance;

                            if (rate > 0) {
                                await walletService.addEarning(
                                    userId,
                                    rate,
                                    `Komisi WO #${ticketNumber} (${workOrder.type}) - Lelang Garansi`,
                                    workOrderId,
                                    'WORK_ORDER'
                                );
                            }

                            // 2. Penalty deduction for the original owner
                            try {
                                const originalOwner = await prismaMitra.mitra.findUnique({
                                    where: { id: workOrder.warrantyOwnerId },
                                    select: { penaltyPsb: true, penaltyMaintenance: true }
                                });

                                // Apply penalty
                                const penaltyAmount = originalOwner?.penaltyPsb || 50000;

                                await walletService.deductBalance(
                                    workOrder.warrantyOwnerId,
                                    penaltyAmount,
                                    `Denda Garansi SLA Pelanggaran Pekerjaan #${ticketNumber}`,
                                    workOrderId,
                                    'WORK_ORDER'
                                );
                                logger.info(`[Warranty] Penalty ${penaltyAmount} deducted from Mitra ${workOrder.warrantyOwnerId}.`);
                            } catch (penaltyErr) {
                                console.error('[Warranty] Failed to deduct penalty:', penaltyErr);
                            }
                        }
                    } else {
                        // --- NORMAL COMMISSION (No Warranty) ---
                        let rate = 0;
                        if (workOrder.type === 'INSTALLATION' && mitra.mitraRateWoPsb) {
                            rate = mitra.mitraRateWoPsb;
                        } else if (mitra.mitraRateWoMaintenance) {
                            rate = mitra.mitraRateWoMaintenance;
                        }

                        if (rate > 0) {
                            await walletService.addEarning(
                                userId,
                                rate,
                                `Komisi WO #${ticketNumber} (${workOrder.type})`,
                                workOrderId,
                                'WORK_ORDER'
                            );
                        }
                    }
                    // --- END WARRANTY LOGIC ---
                }
            } catch (mitraErr) {
                // Non-blocking: log but don't fail the WO completion
                console.error('[MitraCommission] Failed to add WO earning:', mitraErr);
            }

            // Notify Admins
            await notifyAdminsAboutMobileAction({
                workOrderId,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                actionType: 'COMPLETE',
                actionMessage: 'Menyelesaikan Work Order',
                triggeredByUserId: userId,
                triggeredByName: (user?.name as string) || (payload.name as string) || 'Unknown',
                ...(workOrder.departmentId && { departmentId: workOrder.departmentId }),
                ...(workOrder.siteId && { siteId: workOrder.siteId }),
            });



            // System Log
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'WorkOrder',
                userId,
                details: { id: workOrderId, action: 'COMPLETE', notes }
            });

            return NextResponse.json({ success: true, message: 'Work Order Completed' });

        } else if (action === 'PAUSE') {
            // Validate: only IN_PROGRESS can be paused
            if (workOrder.status !== 'IN_PROGRESS') {
                return NextResponse.json(
                    { error: `Tidak dapat menunda Work Order dengan status: ${workOrder.status}. Harus berstatus IN_PROGRESS.` },
                    { status: 400 }
                );
            }

            await repository.updateStatus(workOrderId, 'ON_HOLD', userIdForDb, timestamp);

            if (notes) {
                await repository.addUpdate({
                    workOrderId,
                    updateType: 'NOTE',
                    message: `Work Order Paused: ${notes}`,
                    createdById: userIdForDb
                });
            }

            // Notify Admins
            await notifyAdminsAboutMobileAction({
                workOrderId,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                actionType: 'PAUSE',
                actionMessage: `Menunda Work Order: ${notes || ''}`,
                triggeredByUserId: userId,
                triggeredByName: (user?.name as string) || (payload.name as string) || 'Unknown',
                ...(workOrder.departmentId && { departmentId: workOrder.departmentId }),
                ...(workOrder.siteId && { siteId: workOrder.siteId }),
            });



            // System Log
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'WorkOrder',
                userId,
                details: { id: workOrderId, action: 'PAUSE', notes }
            });

            return NextResponse.json({ success: true, message: 'Work Order Paused' });

        } else if (action === 'COMMENT') {
            if (!notes && !photo && !photoUrl) {
                return NextResponse.json({ error: 'Teks komentar atau foto wajib diisi' }, { status: 400 });
            }

            // Handle photo from JSON URL
            if (photoUrl) {
                await repository.addAttachment(
                    workOrderId,
                    'photo_comment.jpg',
                    photoUrl,
                    0,
                    'image/jpeg',
                    notes || 'Photo Comment',
                    userIdForDb
                );
            }
            // Handle photo from FormData
            else if (photo instanceof File) {
                const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
                const watermarkLines = [
                    format(new Date(), 'dd MMM yyyy HH:mm'),
                    `#${ticketNumber}`,
                    `Tech: ${user?.name || 'Unknown'}`,
                    locationStr
                ];

                const dateStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
                const attachmentPath = await convertAndSaveImage(
                    photo,
                    `public/uploads/workorders/${dateStr}`,
                    `${workOrderId}_comment_${Date.now()}`,
                    'workorder-completion',
                    workOrderId,
                    watermarkLines
                );

                await repository.addAttachment(
                    workOrderId,
                    photo.name,
                    attachmentPath,
                    photo.size,
                    photo.type,
                    notes || 'Photo Comment',
                    userIdForDb
                );
            }

            // Only create text update if no photo was attached (avoid duplication)
            if (!photoUrl && !(photo instanceof File)) {
                await repository.addUpdate({
                    workOrderId,
                    updateType: 'COMMENT',
                    message: notes || '',
                    createdById: userIdForDb
                });
            }

            // Notify Admins
            await notifyAdminsAboutMobileAction({
                workOrderId,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                actionType: 'COMMENT',
                actionMessage: `Komentar Baru: ${notes || 'Photo comment'}`,
                triggeredByUserId: userId,
                triggeredByName: (user?.name as string) || (payload.name as string) || 'Unknown',
                ...(workOrder.departmentId && { departmentId: workOrder.departmentId }),
                ...(workOrder.siteId && { siteId: workOrder.siteId }),
            });



            // System Log
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'WorkOrder',
                userId,
                details: { id: workOrderId, action: 'COMMENT', notes: notes || 'Photo comment' }
            });

            return NextResponse.json({ success: true, message: 'Comment added' });

        } else if (action === 'NOTE') {
            if (!notes && !photo && !photoUrl) {
                return NextResponse.json({ error: 'Catatan atau foto wajib diisi' }, { status: 400 });
            }

            // Handle photo from JSON URL
            if (photoUrl) {
                await repository.addAttachment(
                    workOrderId,
                    'photo_note.jpg',
                    photoUrl,
                    0,
                    'image/jpeg',
                    notes || 'Update Foto',
                    userIdForDb
                );
            }
            // Handle photo from FormData
            else if (photo instanceof File) {
                const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
                const watermarkLines = [
                    format(new Date(), 'dd MMM yyyy HH:mm'),
                    `#${ticketNumber}`,
                    `Tech: ${user?.name || 'Unknown'}`,
                    locationStr
                ];

                const dateStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
                const attachmentPath = await convertAndSaveImage(
                    photo,
                    `public/uploads/workorders/${dateStr}`,
                    `${workOrderId}_note_${Date.now()}`,
                    'workorder-completion',
                    workOrderId,
                    watermarkLines
                );

                await repository.addAttachment(
                    workOrderId,
                    photo.name,
                    attachmentPath,
                    photo.size,
                    photo.type,
                    notes || 'Update Foto',
                    userIdForDb
                );
            }

            await repository.addUpdate({
                workOrderId,
                updateType: 'NOTE',
                message: notes || (photo || photoUrl ? 'Mengunggah foto' : ''),
                createdById: userIdForDb
            });

            // Notify Admins
            await notifyAdminsAboutMobileAction({
                workOrderId,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                actionType: 'NOTE',
                actionMessage: `Menambahkan Catatan: ${notes || 'Photo update'}`,
                triggeredByUserId: userId,
                triggeredByName: (user?.name as string) || (payload.name as string) || 'Unknown',
                ...(workOrder.departmentId && { departmentId: workOrder.departmentId }),
                ...(workOrder.siteId && { siteId: workOrder.siteId }),
            });



            // System Log
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'WorkOrder',
                userId,
                details: { id: workOrderId, action: 'NOTE', notes: notes || 'Photo update' }
            });

            return NextResponse.json({ success: true, message: 'Note added' });
        }

        return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 });

    } catch (error: unknown) {
        console.error('Mobile WO Update Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Terjadi kesalahan server' }, { status: 500 });
    }
}
