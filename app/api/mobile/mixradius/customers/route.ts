import { NextRequest, NextResponse } from 'next/server';
import { getMobileAuthPayload } from '@/lib/mobile-api-auth';
import { MixRadiusConfigError, MixRadiusService } from '@/modules/integrations';

/**
 * GET /api/mobile/mixradius/customers
 * Search customers from MixRadius for WO Request form
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request);
        if (authResult instanceof NextResponse) {
            return authResult;
        }

        const payload = authResult;

        // Check Permission
        const permissions = payload.permissions || [];
        if (!permissions.includes('m_mixradius:read')) {
            return NextResponse.json({ error: 'Dilarang: Memerlukan izin m_mixradius:read' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';

        if (!search || search.length < 2) {
            return NextResponse.json({
                success: true,
                data: [],
                message: 'Minimal 2 karakter diperlukan'
            });
        }

        // Get user's siteId for filtering by ManagementSite -> OwnerGroup
        const userSiteId = payload.siteId as string | undefined;

        const mixRadius = new MixRadiusService();
        const params: { search: string; length: number; siteId?: string } = {
            search,
            length: 20,
        };
        if (userSiteId) {
            params.siteId = userSiteId;
        }
        const result = await mixRadius.fetchCustomersPPP(params);

        // Map to simpler format for mobile
        const customers = result.data.map(c => ({
            id: c.id,
            memberId: c.member_id,
            username: c.username,
            fullname: c.fullname,
            phone: c.phonenumber,
            address: c.address,
            planName: c.plan_name,
            ownerName: c.owner_name,
            status: c.auth_status,
            isOnline: c.online || false, // Status koneksi dari active sessions
        }));

        return NextResponse.json({
            success: true,
            data: customers,
        });
    } catch (error) {
        console.error('Error searching MixRadius customers:', error);

        if (error instanceof MixRadiusConfigError || (error instanceof Error && error.name === 'MixRadiusConfigError')) {
            return NextResponse.json(
                { error: error.message, code: 'MIXRADIUS_CONFIG_ERROR' },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: 'Gagal mencari pelanggan' },
            { status: 500 }
        );
    }
}
