import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { getPointClaimService } from '@/lib/repositories'

// POST - Sales submit claim dengan bukti
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: canvasingId } = await params
    const body = await req.json()

    const service = getPointClaimService()
    const claim = await service.submitClaim({
      canvasingId,
      salesId: session.id,
      buktiUrls: body.buktiUrls || [],
      buktiMetadata: body.buktiMetadata,
      keterangan: body.keterangan,
    })

    return NextResponse.json(claim, { status: 201 })
  } catch (error: any) {
    // Handle specific errors with appropriate status codes
    if (error.message.includes('tidak ditemukan')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message.includes('tidak memiliki akses') || error.message.includes('sudah dikunci')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error.message.includes('belum') || error.message.includes('sudah pernah')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET - Get claim for specific canvasing
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: canvasingId } = await params
    const service = getPointClaimService()
    const claim = await service.getClaimByCanvasingId(canvasingId)

    if (!claim) {
      return NextResponse.json({ claim: null })
    }

    return NextResponse.json({ claim })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
