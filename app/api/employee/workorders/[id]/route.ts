import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/lib/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';

const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/employee/workorders/[id] - Get work order detail
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const workOrder = await workOrderRepo.findById(id);

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: workOrder,
        });
    } catch (error) {
        console.error('Error fetching work order:', error);
        return NextResponse.json({ error: 'Failed to fetch work order' }, { status: 500 });
    }
}

// PATCH /api/employee/workorders/[id] - Actions on work order
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { action, note, resolutionNotes } = body;

        // Get employee from user
        const employee = await prisma.employee.findFirst({
            where: { userId: user.id },
        });

        if (!employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        const workOrder = await workOrderRepo.findById(id);

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
        }

        let result;
        let message = '';

        switch (action) {
            case 'claim':
                // Claim work order - assign to self
                if (workOrder.status !== 'PENDING') {
                    return NextResponse.json(
                        { error: 'Can only claim pending work orders' },
                        { status: 400 }
                    );
                }

                result = await prisma.workOrder.update({
                    where: { id },
                    data: {
                        assignedToId: employee.id,
                        status: 'ASSIGNED',
                    },
                });

                await workOrderRepo.addUpdate({
                    workOrderId: id,
                    updateType: 'STATUS_CHANGE',
                    message: `Work order claimed by ${employee.fullName}`,
                    oldStatus: 'PENDING',
                    newStatus: 'ASSIGNED',
                    createdById: employee.id,
                });

                message = 'Work order claimed successfully';
                break;

            case 'release':
                // Release work order - unassign from self
                if (workOrder.assignedToId !== employee.id) {
                    return NextResponse.json(
                        { error: 'You can only release work orders assigned to you' },
                        { status: 400 }
                    );
                }
                if (!['ASSIGNED', 'ON_HOLD'].includes(workOrder.status)) {
                    return NextResponse.json(
                        { error: 'Cannot release work order that is in progress or completed' },
                        { status: 400 }
                    );
                }

                result = await prisma.workOrder.update({
                    where: { id },
                    data: {
                        assignedToId: null,
                        status: 'PENDING',
                    },
                });

                await workOrderRepo.addUpdate({
                    workOrderId: id,
                    updateType: 'STATUS_CHANGE',
                    message: `Work order released by ${employee.fullName}`,
                    oldStatus: workOrder.status,
                    newStatus: 'PENDING',
                    createdById: employee.id,
                });

                message = 'Work order released successfully';
                break;

            case 'start':
                // Start work order
                if (workOrder.assignedToId !== employee.id) {
                    return NextResponse.json(
                        { error: 'You can only start work orders assigned to you' },
                        { status: 400 }
                    );
                }
                result = await workOrderRepo.start(id, employee.id);
                message = 'Work order started successfully';
                break;

            case 'complete':
                // Complete work order
                if (workOrder.assignedToId !== employee.id) {
                    return NextResponse.json(
                        { error: 'You can only complete work orders assigned to you' },
                        { status: 400 }
                    );
                }

                // Get attachmentUrls from body
                const { attachmentUrls, note: completionNote } = body;

                // Complete the work order
                result = await workOrderRepo.complete(id, completionNote || resolutionNotes, employee.id);

                // Save attachment photos if provided
                if (attachmentUrls && Array.isArray(attachmentUrls) && attachmentUrls.length > 0) {
                    for (let i = 0; i < attachmentUrls.length; i++) {
                        const url = attachmentUrls[i];
                        await prisma.workOrderAttachment.create({
                            data: {
                                workOrderId: id,
                                fileName: `completion_photo_${i + 1}.webp`,
                                filePath: url,
                                fileSize: 0, // Unknown at this point
                                fileType: 'image/webp',
                                caption: `[COMPLETION] Bukti Penyelesaian ${i + 1}`,
                                uploadedById: employee.id,
                            },
                        });
                    }
                }

                message = 'Work order completed successfully';
                break;

            case 'hold':
                // Put work order on hold
                if (workOrder.assignedToId !== employee.id) {
                    return NextResponse.json(
                        { error: 'You can only modify work orders assigned to you' },
                        { status: 400 }
                    );
                }

                // Get hold attachment
                const { attachmentUrl: holdAttachmentUrl, note: holdNote } = body;

                result = await workOrderRepo.updateStatus(id, 'ON_HOLD', employee.id);

                // Add hold note/update
                await workOrderRepo.addUpdate({
                    workOrderId: id,
                    updateType: 'NOTE',
                    message: holdNote || 'Pekerjaan ditunda',
                    createdById: employee.id,
                });

                // Save attachment if provided
                if (holdAttachmentUrl) {
                    await prisma.workOrderAttachment.create({
                        data: {
                            workOrderId: id,
                            fileName: 'hold_photo.webp',
                            filePath: holdAttachmentUrl,
                            fileSize: 0,
                            fileType: 'image/webp',
                            caption: '[HOLD] Bukti Penundaan',
                            uploadedById: employee.id,
                        },
                    });
                }

                message = 'Work order put on hold';
                break;

            case 'resume':
                // Resume work order from hold
                if (workOrder.assignedToId !== employee.id) {
                    return NextResponse.json(
                        { error: 'You can only modify work orders assigned to you' },
                        { status: 400 }
                    );
                }
                result = await workOrderRepo.updateStatus(id, 'IN_PROGRESS', employee.id);
                message = 'Work order resumed';
                break;

            case 'addNote':
                // Add progress note
                if (!note) {
                    return NextResponse.json(
                        { error: 'Note content is required' },
                        { status: 400 }
                    );
                }

                // Get optional attachment
                const { attachmentUrl: noteAttachmentUrl } = body;

                await workOrderRepo.addUpdate({
                    workOrderId: id,
                    updateType: 'NOTE',
                    message: note,
                    createdById: employee.id,
                });

                // Save attachment if provided
                if (noteAttachmentUrl) {
                    await prisma.workOrderAttachment.create({
                        data: {
                            workOrderId: id,
                            fileName: 'note_photo.webp',
                            filePath: noteAttachmentUrl,
                            fileSize: 0,
                            fileType: 'image/webp',
                            caption: `[NOTE] ${note.substring(0, 50)}${note.length > 50 ? '...' : ''}`,
                            uploadedById: employee.id,
                        },
                    });
                }

                result = await workOrderRepo.findById(id);
                message = 'Note added successfully';
                break;

            default:
                return NextResponse.json(
                    { error: 'Invalid action' },
                    { status: 400 }
                );
        }

        return NextResponse.json({
            success: true,
            data: result,
            message,
        });
    } catch (error) {
        console.error('Error performing work order action:', error);
        return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
    }
}
