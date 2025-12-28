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
        // 2. Parse Request (FormData or JSON)
        let action, notes, photo, latitude, longitude, locationName, photoUrl, photoUrls;
        
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const body = await request.json();
            action = body.action;
            notes = body.notes;
            latitude = body.latitude;
            longitude = body.longitude;
            locationName = body.locationName;
            photoUrl = body.photoUrl; // Single photo (Note)
            photoUrls = body.photoUrls; // Multiple photos (Complete)
        } else {
             const formData: any = await request.formData();
             action = formData.get('action') as string;
             notes = formData.get('notes') as string;
             photo = formData.get('photo') as File;
             latitude = formData.get('latitude') as string;
             longitude = formData.get('longitude') as string;
             locationName = formData.get('locationName') as string;
        }

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
        const workOrder = await prisma.workOrders.findUnique({
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
            // CASE 1: JSON (Already uploaded)
            if (photoUrls && Array.isArray(photoUrls) && photoUrls.length > 0) {
                 for (let i = 0; i < photoUrls.length; i++) {
                      const url = photoUrls[i];
                      await repository.addAttachment(
                           workOrderId,
                           `photo_${i}.jpg`,
                           url,
                           0, // Size unknown
                           'image/jpeg',
                           `[COMPLETION] Bukti Penyelesaian ${i + 1}`,
                           userId
                      );
                 }
            } 
            // CASE 2: Form Data (File Upload)
            else {
                const formData = await request.formData().catch(() => new FormData()); // Re-parse if needed or use existing if scoped
                // Actually we can't re-read stream. We need to handle this better in step 2 if we want to share logic.
                // But simplified: If contentType is NOT json, we already parsed formData above? 
                // Wait, formData variable in step 2 is scoped.
                // We need to access formData from step 2.
                // I will assume if `photoUrls` is undefined, we might have `formData`.
                // BUT `formData` variable defined in "step 2" logic above is inside "else" block.
                // I should lift `formData` variable or just rely on `photo` being defined if "step 2" was formData.
                
                // Oops, `photo` variable (single) is defined.
                // But `photos` (multiple) was handled locally in COMPLETE block (Line 77).
                // I need to change how `photos` is retrieved.
                
                // If NOT JSON:
                if (!contentType.includes('application/json')) {
                     const formData: any = await request.formData();
                     const photos = formData.getAll('photos') as File[];
                     const singlePhoto = formData.get('photo') as File;
                     if (singlePhoto && !photos.includes(singlePhoto)) {
                         photos.push(singlePhoto);
                     }
                     
                     if (photos.length > 0) {
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
            if (!notes && !photo && !photoUrl) {
                return NextResponse.json({ error: 'Notes or photo required' }, { status: 400 });
            }

            let attachmentPath = null;
            
            // CASE 1: JSON (Already uploaded)
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
            // CASE 2: File Upload (Server Watermark)
            else if (photo) {
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
