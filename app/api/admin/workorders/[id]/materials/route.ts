import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';
import { getWorkOrderService, type UserContext } from '@/modules/work-order';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const addMaterialSchema = z.object({
    barangId: z.string().min(1, 'Barang harus dipilih'),
    quantity: z.number().positive('Jumlah harus lebih dari 0'),
    notes: z.string().optional(),
    gudangId: z.string().optional(),
});

/**
 * POST /api/admin/workorders/{id}/materials:
 * Add material to work order
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    if (!await hasPermission('list:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah work order');
    }

    const body = await req.json();
    const validation = addMaterialSchema.safeParse(body);
    if (!validation.success) {
        return ApiErrors.badRequest('Data tidak valid', { errors: validation.error.flatten() });
    }

    const { barangId, quantity, notes, gudangId } = validation.data;

    // Fetch user siteId for warehouse resolution
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { siteId: true, departmentId: true, role: true }
    });

    if (!dbUser) return ApiErrors.unauthorized();

    // Resolve warehouse:
    // 1. Explicitly provided gudangId
    // 2. Fallback to a warehouse in user's site
    let targetGudangId = gudangId;

    if (!targetGudangId && dbUser.siteId) {
        const siteGudang = await prisma.gudang.findFirst({
            where: { 
                sites: {
                    some: {
                        id: dbUser.siteId
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });
        if (siteGudang) {
            targetGudangId = siteGudang.id;
        }
    }

    const userContext: UserContext = {
        id: user.id,
        role: user.role,
        permissions: ctx.permissions,
        siteId: dbUser.siteId || undefined,
        departmentId: dbUser.departmentId || undefined,
    }

    const service = getWorkOrderService();
    const result = await service.addMaterial(id, barangId, quantity, userContext, notes, targetGudangId);

    if (!result.success) {
        return apiError(
            result.error || 'Gagal menambahkan material', 
            result.code === 'ADD_MATERIAL_ERROR' ? ErrorCodes.VALIDATION_ERROR : ErrorCodes.INTERNAL_ERROR, 
            { status: 400 }
        );
    }

    return apiSuccess(result.data, { message: 'Material berhasil ditambahkan' });
})
