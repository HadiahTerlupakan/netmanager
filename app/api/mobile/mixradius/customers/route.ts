import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { MixRadiusService } from '@/modules/integrations';

/**
 * GET /api/mobile/mixradius/customers
 * Search customers from MixRadius for WO Request form
 */
export async function GET(request: NextRequest) {
    try {
        // Auth Check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Token not provided' }, { status: 401 });
        }
        const payload = await verifyMobileToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Check Permission
        const permissions = payload.permissions || [];
        if (!permissions.includes('m_mixradius:read')) {
            return NextResponse.json({ error: 'Forbidden: Requires m_mixradius:read permission' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';

        if (!search || search.length < 2) {
            return NextResponse.json({
                success: true,
                data: [],
                message: 'Minimum 2 characters required'
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
        return NextResponse.json(
            { error: 'Failed to search customers' },
            { status: 500 }
        );
    }
}
