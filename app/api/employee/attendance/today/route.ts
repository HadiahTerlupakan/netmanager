import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/employee/attendance/today - Get today's attendance for current employee
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get employee from session or find by user email
        let employeeId = session.user?.employee?.id

        if (!employeeId && session.user?.email) {
            const employee = await prisma.employee.findFirst({
                where: { email: session.user.email }
            })
            employeeId = employee?.id
        }

        if (!employeeId) {
            return NextResponse.json({
                success: true,
                attendance: null,
                message: 'No employee record found'
            })
        }

        const now = new Date()
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

        const attendance = await prisma.attendance.findFirst({
            where: {
                employeeId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                }
            }
        })

        return NextResponse.json({
            success: true,
            attendance
        })
    } catch (error: any) {
        console.error('Error fetching today attendance:', error)
        return NextResponse.json({
            error: error.message || 'Internal server error',
            success: false
        }, { status: 500 })
    }
}

// POST /api/employee/attendance/today - Check-in or check-out
export async function POST(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get employee from session or find by user email
        let employeeId = session.user?.employee?.id

        if (!employeeId && session.user?.email) {
            const employee = await prisma.employee.findFirst({
                where: { email: session.user.email }
            })
            employeeId = employee?.id
        }

        if (!employeeId) {
            return NextResponse.json({
                error: 'No employee record found',
                success: false
            }, { status: 404 })
        }

        const body = await req.json()
        const { action, latitude, longitude, location } = body

        const now = new Date()
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

        // Find existing attendance for today
        let attendance = await prisma.attendance.findFirst({
            where: {
                employeeId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                }
            }
        })

        if (action === 'check-in') {
            if (attendance) {
                return NextResponse.json({
                    error: 'Already checked in today',
                    success: false,
                    attendance
                }, { status: 400 })
            }

            // Determine if late (after 9 AM)
            const checkInTime = now.toTimeString().slice(0, 8)
            const isLate = now.getHours() >= 9

            attendance = await prisma.attendance.create({
                data: {
                    employeeId,
                    date: startOfDay,
                    checkIn: checkInTime,
                    status: isLate ? 'LATE' : 'PRESENT',
                    checkInLatitude: latitude ? parseFloat(latitude) : null,
                    checkInLongitude: longitude ? parseFloat(longitude) : null,
                    checkInLocation: location || null,
                }
            })

            return NextResponse.json({
                success: true,
                message: isLate ? 'Checked in (Late)' : 'Checked in successfully',
                attendance
            })
        } else if (action === 'check-out') {
            if (!attendance) {
                return NextResponse.json({
                    error: 'Not checked in today',
                    success: false
                }, { status: 400 })
            }

            if (attendance.checkOut) {
                return NextResponse.json({
                    error: 'Already checked out today',
                    success: false,
                    attendance
                }, { status: 400 })
            }

            const checkOutTime = now.toTimeString().slice(0, 8)

            attendance = await prisma.attendance.update({
                where: { id: attendance.id },
                data: {
                    checkOut: checkOutTime,
                    checkOutLatitude: latitude ? parseFloat(latitude) : null,
                    checkOutLongitude: longitude ? parseFloat(longitude) : null,
                    checkOutLocation: location || null,
                }
            })

            return NextResponse.json({
                success: true,
                message: 'Checked out successfully',
                attendance
            })
        }

        return NextResponse.json({
            error: 'Invalid action. Use check-in or check-out',
            success: false
        }, { status: 400 })

    } catch (error: any) {
        console.error('Error processing attendance:', error)
        return NextResponse.json({
            error: error.message || 'Internal server error',
            success: false
        }, { status: 500 })
    }
}
