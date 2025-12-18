import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { getOnuService } from '@/modules/network'

export async function POST(req: NextRequest) {
  try {
    // Authentication check
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json()
    const { onuList } = body // Array of { gponOnu: string, oltId: string }

    if (!onuList || !Array.isArray(onuList) || onuList.length === 0) {
      return NextResponse.json(
        { error: 'onuList is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    const onuService = getOnuService();
    const updatedOnus = await onuService.updateOnus(onuList);

    return NextResponse.json({
      success: true,
      updated: updatedOnus.filter(u => u.updated).length,
      total: updatedOnus.length,
      onus: updatedOnus,
    })
  } catch (error: any) {
    console.error('[ONU-Update-API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update ONUs' },
      { status: 500 }
    )
  }
}

