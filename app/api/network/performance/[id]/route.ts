import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireAdmin() {
  const session = await getServerSession(authConfig)
  if (!session) {
    return null
  }
  return session
}

/**
 * @swagger
 * /api/network/performance/{id}:
 *   get:
 *     summary: Get network performance data by ID
 *     description: Mengambil data performa jaringan berdasarkan ID
 *     tags: [Network Performance]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Performance data ID
 *     responses:
 *       200:
 *         description: Network performance data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NetworkPerformance'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Performance data not found
 *       500:
 *         description: Server error
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    try {
      const performanceData = await prisma.networkPerformance.findUnique({
        where: { id },
      })

      if (!performanceData) {
        return NextResponse.json({ error: 'Data performa tidak ditemukan' }, { status: 404 })
      }

      return NextResponse.json({ data: performanceData })
    } catch (prismaError: unknown) {
      // Handle case where model doesn't exist yet
      if (prismaError instanceof Error && (prismaError as unknown as Record<string, unknown>).code === 'P2021') {
        return NextResponse.json(
          { error: 'Network performance monitoring will be available after database migration' },
          { status: 503 }
        )
      }
      throw prismaError
    }
  } catch (error: unknown) {
    console.error('Error fetching network performance data:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal memuat data performa jaringan' },
      { status: 500 }
    )
  }
}