import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';
import { getWorkOrderService } from '@/modules/work-order';
import { z } from 'zod';

const addMaterialSchema = z.object({
    barangId: z.string().min(1, 'Barang harus dipilih'),
    quantity: z.number().positive('Jumlah harus lebih dari 0'),
    notes: z.string().optional(),
});

/**
 * @swagger
 * /api/admin/workorders/{id}/materials:
 *   post:
 *     summary: Add material to work order
 *     tags: [Work Orders]
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        // Check permission (adjust as needed based on your RBAC system)
        if (!await hasPermission('list:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah work order');
        }

        const { id } = await params;
        const body = await request.json();
        
        const validation = addMaterialSchema.safeParse(body);
        if (!validation.success) {
            return ApiErrors.badRequest('Data tidak valid', { errors: validation.error.flatten() });
        }

        const { barangId, quantity, notes } = validation.data;

        const service = getWorkOrderService();
        // Updated service call with actorId (user.id)
        const result = await service.addMaterial(id, barangId, quantity, user.id, notes);

        if (!result.success) {
            return apiError(
                result.error || 'Gagal menambahkan material', 
                result.code === 'ADD_MATERIAL_ERROR' ? ErrorCodes.VALIDATION_ERROR : ErrorCodes.INTERNAL_ERROR, 
                { status: 400 }
            );
        }

        return apiSuccess(result.data, { message: 'Material berhasil ditambahkan' });

    } catch (error) {
        console.error('Error adding material:', error);
        return ApiErrors.internalError('Terjadi kesalahan saat menambahkan material');
    }
}
