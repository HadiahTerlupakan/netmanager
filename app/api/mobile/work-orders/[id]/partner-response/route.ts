import { NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';
import { prisma } from '@/modules/database';
import { getMobileAuthPayload } from '@/lib/mobile-api-auth';
import { apiError, ErrorCodes } from '@/lib/api-response'

/**
 * POST /api/mobile/work-orders/[id]/partner-response
 * Partner approve atau reject invitation untuk work order
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Autentikasi user
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const userId = authResult.id as string;
    const tenantId = authResult.tenantId as string;

    const { id: workOrderId } = await params;

    // Parse dan validasi request body
    const bodySchema = z.object({
      response: z.enum(['APPROVED', 'REJECTED'], {
        error: 'Response harus APPROVED atau REJECTED',
      }),
    });

    const body = await request.json();
    const validatedData = bodySchema.parse(body);

    // Validasi: Work order exists
    const workOrder = await prisma.workOrders.findFirst({
      where: { id: workOrderId, tenantId },
      select: { 
        id: true, 
        workOrderNumber: true, 
        status: true,
        assignedToId: true,
      },
    });

    if (!workOrder) {
      return apiError('Work order tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 });
    }

    // Cari assignment berdasarkan workOrderId dan userId dari session
    const assignment = await prisma.workOrderAssignments.findFirst({
      where: {
        workOrderId: workOrderId,
        userId: userId,
        role: 'PARTNER',
        tenantId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    if (!assignment) {
      return apiError('Anda tidak diundang sebagai partner di work order ini', ErrorCodes.NOT_FOUND, { status: 404 });
    }

    // Validasi: Assignment masih PENDING
    if (assignment.status !== 'PENDING') {
      return NextResponse.json(
        { 
          error: `Undangan sudah ${assignment.status === 'APPROVED' ? 'diterima' : 'ditolak'} sebelumnya`,
          currentStatus: assignment.status,
        },
        { status: 400 }
      );
    }

    // Update status assignment
    const updatedAssignment = await prisma.workOrderAssignments.update({
      where: { id: assignment.id, tenantId },
      data: {
        status: validatedData.response,
        respondedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // TODO: Kirim notifikasi ke lead technician (opsional)
    // Bisa menggunakan sistem notifikasi yang sudah ada untuk mengirim notifikasi
    // ke lead technician (workOrder.assignedToId) bahwa partner sudah merespons
    
    // Contoh implementasi notifikasi (jika diperlukan):
    // if (workOrder.assignedToId) {
    //   await prisma.notifications.create({
    //     data: {
    //       id: crypto.randomUUID(),
    //       type: 'WORK_ORDER_PARTNER_RESPONSE',
    //       priority: 'NORMAL',
    //       title: `Partner ${validatedData.response === 'APPROVED' ? 'menerima' : 'menolak'} undangan`,
    //       message: `${user.name} ${validatedData.response === 'APPROVED' ? 'menerima' : 'menolak'} undangan sebagai partner di WO ${workOrder.workOrderNumber}`,
    //       userId: workOrder.assignedToId,
    //       sourceType: 'WORK_ORDER',
    //       sourceId: workOrderId,
    //       link: `/admin/work-orders/${workOrderId}`,
    //     },
    //   });
    // }

    return NextResponse.json({
      success: true,
      assignment: {
        id: updatedAssignment.id,
        workOrderId: updatedAssignment.workOrderId,
        userId: updatedAssignment.userId,
        role: updatedAssignment.role,
        status: updatedAssignment.status,
        assignedAt: updatedAssignment.assignedAt,
        respondedAt: updatedAssignment.respondedAt,
        assignedById: updatedAssignment.assignedById,
        user: updatedAssignment.user,
      },
      message: `Undangan berhasil ${validatedData.response === 'APPROVED' ? 'diterima' : 'ditolak'}`,
    });
  } catch (error) {
    console.error('[API] Error responding to partner invitation:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: error.issues },
        { status: 400 }
      );
    }

    return apiError('Terjadi kesalahan server', ErrorCodes.INTERNAL_ERROR, { status: 500 });
  }
}
