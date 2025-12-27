import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Get work order detail with tasks and updates
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params

        const workOrder = await prisma.workOrders.findUnique({
            where: { id },
            include: {
                pelanggan: {
                    select: {
                        nama: true,
                        alamat: true,
                        noTelp: true
                    }
                },
                assignedTo: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                tasks: {
                    orderBy: { order: 'asc' },
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                updates: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                attachments: {
                    orderBy: { uploadedAt: 'desc' },
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                assignments: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            }
        })

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order tidak ditemukan' }, { status: 404 })
        }

        return NextResponse.json({ workOrder })
    } catch (error) {
        console.error('Error fetching work order detail:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
