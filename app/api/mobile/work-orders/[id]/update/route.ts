import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { convertAndSaveImage } from '@/lib/utils/image-upload';
import { format } from 'date-fns';

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
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
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        const payload = await verifyMobileToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const userId = payload.id as string;
        const workOrderId = params.id;
        const repository = new WorkOrderRepository(prisma);

        // ============================================
        // 2. FETCH WORK ORDER & AUTHORIZATION CHECK
        // ============================================
        const workOrder = await prisma.workOrders.findUnique({
            where: { id: workOrderId },
            include: {
                ticket: { select: { ticketNumber: true } },
                assignments: { select: { userId: true, status: true } },
                department: { select: { id: true, name: true } },
            }
        });

        if (!workOrder) {
            return NextResponse.json({ error: 'Work Order not found' }, { status: 404 });
        }

        // Check if user is authorized to update this WO
        const isAssignedTo = workOrder.assignedToId === userId;
        const isAssignmentMember = workOrder.assignments.some(
            (a) => a.userId === userId && a.status !== 'REJECTED'
        );
        const isCreator = workOrder.createdById === userId;

        if (!isAssignedTo && !isAssignmentMember && !isCreator) {
            return NextResponse.json(
                { error: 'You are not authorized to update this Work Order' },
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
            return NextResponse.json({ error: 'Action is required' }, { status: 400 });
        }

        // ============================================
        // 6. HANDLE ACTIONS
        // ============================================
        if (action === 'START') {
            // Validate status transition: only ASSIGNED can be started
            if (!['ASSIGNED', 'ON_HOLD'].includes(workOrder.status)) {
                return NextResponse.json(
                    { error: `Cannot start Work Order with status: ${workOrder.status}. Must be ASSIGNED or ON_HOLD.` },
                    { status: 400 }
                );
            }

            await repository.start(workOrderId, userId, timestamp);

            if (notes) {
                await repository.addUpdate({
                    workOrderId,
                    updateType: 'NOTE',
                    message: notes,
                    createdById: userId
                });
            }

            return NextResponse.json({ success: true, message: 'Work Order Started' });

        } else if (action === 'COMPLETE') {
            // Validate status transition
            if (workOrder.status !== 'IN_PROGRESS') {
                return NextResponse.json(
                    { error: `Cannot complete Work Order with status: ${workOrder.status}. Must be IN_PROGRESS.` },
                    { status: 400 }
                );
            }

            // Handle photos from JSON (already uploaded URLs)
            if (photoUrls && Array.isArray(photoUrls) && photoUrls.length > 0) {
                for (let i = 0; i < photoUrls.length; i++) {
                    const url = photoUrls[i];
                    await repository.addAttachment(
                        workOrderId,
                        `photo_${i}.jpg`,
                        url,
                        0,
                        'image/jpeg',
                        `[COMPLETION] Bukti Penyelesaian ${i + 1}`,
                        userId
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
                    
                    const dateStr = new Date().toISOString().split('T')[0];
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
                        userId
                    );
                }
            }

            await repository.complete(workOrderId, notes, userId, timestamp);
            return NextResponse.json({ success: true, message: 'Work Order Completed' });

        } else if (action === 'PAUSE') {
            // Validate: only IN_PROGRESS can be paused
            if (workOrder.status !== 'IN_PROGRESS') {
                return NextResponse.json(
                    { error: `Cannot pause Work Order with status: ${workOrder.status}. Must be IN_PROGRESS.` },
                    { status: 400 }
                );
            }

            await repository.updateStatus(workOrderId, 'ON_HOLD', userId, timestamp);

            if (notes) {
                await repository.addUpdate({
                    workOrderId,
                    updateType: 'NOTE',
                    message: `Work Order Paused: ${notes}`,
                    createdById: userId
                });
            }
            return NextResponse.json({ success: true, message: 'Work Order Paused' });

        } else if (action === 'NOTE') {
            if (!notes && !photo && !photoUrl) {
                return NextResponse.json({ error: 'Notes or photo required' }, { status: 400 });
            }

            // Handle photo from JSON URL
            if (photoUrl) {
                await repository.addAttachment(
                    workOrderId,
                    'photo_note.jpg',
                    photoUrl,
                    0,
                    'image/jpeg',
                    notes || 'Photo Update',
                    userId
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

                const dateStr = new Date().toISOString().split('T')[0];
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
                    notes || 'Photo Update',
                    userId
                );
            }

            await repository.addUpdate({
                workOrderId,
                updateType: 'NOTE',
                message: notes || (photo || photoUrl ? 'Uploaded a photo' : ''),
                createdById: userId
            });
            
            return NextResponse.json({ success: true, message: 'Note added' });
        }

        return NextResponse.json({ error: 'Invalid Action' }, { status: 400 });

    } catch (error: any) {
        console.error('Mobile WO Update Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
