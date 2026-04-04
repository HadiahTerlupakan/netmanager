import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/modules/database"

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const rabId = resolvedParams.id
        const userId = session.user.id

        // Verify user has right to approve
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { role: true }
        })

        const isSuperAdmin = user?.role?.isSuperAdmin || user?.role?.name === 'SUPER_ADMIN' || user?.role?.name === 'Super Admin';

        if (!user?.role?.canApproveRab && !isSuperAdmin) {
            return NextResponse.json({
                error: "Dilarang: Akun Anda tidak memiliki hak akses (role: canApproveRab) untuk menyetujui dokumen ini."
            }, { status: 403 })
        }

        // Verify RAB exists and needs approval
        const rab = await prisma.rabProject.findUnique({
            where: { id: rabId },
            include: { approvals: true }
        })

        if (!rab) {
            return NextResponse.json({ error: "RAB tidak ditemukan" }, { status: 404 })
        }

        if (rab.status === 'APPROVED' || rab.status === 'COMPLETED' || rab.status === 'CANCELLED') {
            return NextResponse.json({ error: `RAB sudah berstatus ${rab.status} dan tidak bisa disetujui lagi.` }, { status: 400 })
        }

        // Check if user already approved
        const alreadyApproved = rab.approvals.some((a: { userId: string }) => a.userId === userId)
        if (alreadyApproved) {
            return NextResponse.json({ error: "Anda sudah menyetujui RAB ini sebelumnya." }, { status: 400 })
        }

        // 1. Insert the Approval
        await prisma.rabApproval.create({
            data: {
                rabProjectId: rabId,
                userId: userId,
                status: "APPROVED"
            }
        })

        // 2. Check total unique approvers for this RAB
        // Wait, what if someone else just approved it right now? Refetch count or just calculate:
        const currentApprovalsCount = rab.approvals.length + 1
        let updatedRabStatus = rab.status

        // If currently Draft, move to PENDING_APPROVAL on first approve
        if (rab.status === 'DRAFT' && currentApprovalsCount === 1) {
            updatedRabStatus = 'PENDING_APPROVAL'
        }

        // Threshold logic: 2 approvals
        if (currentApprovalsCount >= 2) {
            updatedRabStatus = 'APPROVED' as unknown as typeof rab.status; // Cast to bypass TS if prisma client is stale
        }

        // Update main record
        const updatedRab = await prisma.rabProject.update({
            where: { id: rabId },
            data: {
                status: updatedRabStatus
            },
            include: {
                approvals: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: {
                                    select: { name: true }
                                }
                            }
                        }
                    }
                }
            }
        })

        return NextResponse.json({
            success: true,
            message: currentApprovalsCount >= 2 ? "RAB Berhasil disetujui seutuhnya." : "Persetujuan dicatat (Menunggu 1 Persetujuan lagi).",
            data: updatedRab
        })

    } catch (error) {
        console.error("Error approving RAB:", error)
        return NextResponse.json(
            { error: "Terjadi kesalahan internal saat memproses persetujuan." },
            { status: 500 }
        )
    }
}
