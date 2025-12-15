import { NextRequest, NextResponse } from 'next/server'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) {
            return authResult.response
        }

        // Get customer with username (PPPoE username)
        const customer = await prisma.pelanggan.findUnique({
            where: { id: authResult.session.id },
            select: {
                id: true,
                username: true, // PPPoE username
                status: true,
            },
        })

        if (!customer) {
            return NextResponse.json(
                { error: 'Data pelanggan tidak ditemukan' },
                { status: 404 }
            )
        }

        // Get latest accounting record for this username from RadAcct
        const latestSession = await prisma.radAcct.findFirst({
            where: {
                username: customer.username,
            },
            orderBy: { acctStartTime: 'desc' },
        })

        // Check if online (acctStopTime is null means session is still active)
        const isOnline = latestSession && !latestSession.acctStopTime

        // Calculate session duration if online
        let sessionDuration = 0
        if (isOnline && latestSession.acctStartTime) {
            sessionDuration = Math.floor(
                (Date.now() - new Date(latestSession.acctStartTime).getTime()) / 1000
            )
        }

        // Get total usage for current month
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const monthlyUsage = await prisma.radAcct.aggregate({
            where: {
                username: customer.username,
                acctStartTime: {
                    gte: startOfMonth,
                },
            },
            _sum: {
                acctInputOctets: true,  // Download (from user perspective)
                acctOutputOctets: true, // Upload (from user perspective)
            },
        })

        // Get total usage all time
        const totalUsage = await prisma.radAcct.aggregate({
            where: {
                username: customer.username,
            },
            _sum: {
                acctInputOctets: true,
                acctOutputOctets: true,
            },
        })

        // Format bytes to human readable
        const formatBytes = (bytes: bigint | null) => {
            if (!bytes) return { bytes: 0, formatted: '0 B' }
            const numBytes = Number(bytes)
            if (numBytes === 0) return { bytes: 0, formatted: '0 B' }

            const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
            const i = Math.floor(Math.log(numBytes) / Math.log(1024))
            const formatted = parseFloat((numBytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i]

            return { bytes: numBytes, formatted }
        }

        // Format duration to human readable
        const formatDuration = (seconds: number) => {
            const hours = Math.floor(seconds / 3600)
            const minutes = Math.floor((seconds % 3600) / 60)
            const secs = seconds % 60

            if (hours > 0) {
                return `${hours}j ${minutes}m`
            } else if (minutes > 0) {
                return `${minutes}m ${secs}d`
            }
            return `${secs}d`
        }

        return NextResponse.json({
            success: true,
            connection: {
                isOnline,
                ipAddress: isOnline ? latestSession.framedIpAddress : null,
                nasIpAddress: isOnline ? latestSession.nasIpAddress : null,
                sessionId: isOnline ? latestSession.acctSessionId : null,
                sessionStart: isOnline ? latestSession.acctStartTime : null,
                sessionDuration: isOnline ? sessionDuration : 0,
                sessionDurationFormatted: isOnline ? formatDuration(sessionDuration) : null,
                lastSeen: latestSession?.acctStopTime || latestSession?.acctUpdateTime || null,
            },
            usage: {
                monthly: {
                    download: formatBytes(monthlyUsage._sum.acctInputOctets),
                    upload: formatBytes(monthlyUsage._sum.acctOutputOctets),
                    total: formatBytes(
                        (monthlyUsage._sum.acctInputOctets || BigInt(0)) +
                        (monthlyUsage._sum.acctOutputOctets || BigInt(0))
                    ),
                    period: {
                        start: startOfMonth,
                        end: new Date(),
                    },
                },
                allTime: {
                    download: formatBytes(totalUsage._sum.acctInputOctets),
                    upload: formatBytes(totalUsage._sum.acctOutputOctets),
                    total: formatBytes(
                        (totalUsage._sum.acctInputOctets || BigInt(0)) +
                        (totalUsage._sum.acctOutputOctets || BigInt(0))
                    ),
                },
            },
        })
    } catch (error) {
        console.error('[Customer Usage Error]:', error)
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}
