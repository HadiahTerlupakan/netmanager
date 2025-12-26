import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { convertAndSaveImage } from '@/lib/utils/image-upload';
import { format } from 'date-fns';

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        // 1. Auth Check
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

        // 2. Parse FormData
        const formData: any = await request.formData();
        const action = formData.get('action') as string; // 'START' | 'PAUSE' | 'COMPLETE' | 'NOTE'
        const notes = formData.get('notes') as string;
        const photo = formData.get('photo') as File;
        const latitude = formData.get('latitude') as string;
        const longitude = formData.get('longitude') as string;
        const locationName = formData.get('locationName') as string;

        // Construct Location String: Name (Lat, Long)
        // Construct Location String: Address + Coordinates
        let locationStr = 'Loc: Unknown';
        const coords = (latitude && longitude) ? `(${latitude.slice(0, 8)}, ${longitude.slice(0, 8)})` : '';

        if (locationName && coords) {
            locationStr = `${locationName} ${coords}`;
        } else if (locationName) {
            locationStr = locationName;
        } else if (coords) {
            locationStr = `Loc: ${coords}`;
        }

        // Fetch Work Order to get Ticket Number
        const workOrder = await prisma.workOrder.findUnique({
            where: { id: workOrderId },
            include: { ticket: { select: { ticketNumber: true } } }
        });

        const ticketNumber = workOrder?.ticket?.ticketNumber || workOrder?.workOrderNumber || workOrderId;

        // 3. Handle Actions
        if (action === 'START') {
            await repository.start(workOrderId, userId);

            // Add note if provided
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
            // Handle multiple photos
            const photos = formData.getAll('photos') as File[];
            const singlePhoto = formData.get('photo') as File; // Backward compatibility
            if (singlePhoto && !photos.includes(singlePhoto)) {
                photos.push(singlePhoto);
            }

            if (photos.length > 0) {
                // Fetch user name for watermark
                const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

                // Process each photo
                for (let i = 0; i < photos.length; i++) {
                    const p = photos[i];
                    // Skip if not a file
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

            await repository.complete(workOrderId, notes, userId);
            return NextResponse.json({ success: true, message: 'Work Order Completed' });

        } else if (action === 'PAUSE') {
            // "Pause" usually means status -> ON_HOLD or PENDING?
            // Repo doesn't have explicit 'pause'. We'll use updateStatus('ON_HOLD')
            await repository.updateStatus(workOrderId, 'ON_HOLD', userId);

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
            if (!notes && !photo) {
                return NextResponse.json({ error: 'Notes or photo required' }, { status: 400 });
            }

            let attachmentPath = null;
            if (photo) {
                // Fetch user name for watermark
                const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
                const watermarkLines = [
                    format(new Date(), 'dd MMM yyyy HH:mm'),
                    `#${ticketNumber}`,
                    `Tech: ${user?.name || 'Unknown'}`,
                    locationStr
                ];

                const dateStr = new Date().toISOString().split('T')[0];
                attachmentPath = await convertAndSaveImage(
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
                message: notes || (photo ? 'Uploaded a photo' : ''),
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
