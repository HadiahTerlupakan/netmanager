import { NextRequest, NextResponse } from 'next/server'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { LocationTrackingService } from '@/modules/attendance/services/LocationTrackingService'

/**
 * POST /api/mobile/location
 * Menerima update lokasi dari mobile app
 * Hanya menyimpan jika user sedang dalam status check-in
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing or invalid token' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const payload = await verifyMobileToken(token)
        if (!payload) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
        }

        const userId = payload.id as string
        const body = await request.json()

        console.log(`[API] Location update received for user ${userId}`, JSON.stringify(body))

        const locationService = new LocationTrackingService()

        // Cek apakah user sedang check-in
        const isCheckedIn = await locationService.isUserCurrentlyCheckedIn(userId)
        console.log(`[API] User ${userId} check-in status: ${isCheckedIn}`)

        if (!isCheckedIn) {
            return NextResponse.json({ 
                success: false, 
                message: 'User is not currently checked in',
                shouldStopTracking: true 
            })
        }

        // Handle batch locations (offline sync)
        if (Array.isArray(body.locations)) {
            const count = await locationService.saveLocations(userId, body.locations.map((loc: any) => ({
                latitude: loc.latitude,
                longitude: loc.longitude,
                accuracy: loc.accuracy,
                altitude: loc.altitude,
                speed: loc.speed,
                heading: loc.heading,
                batteryLevel: loc.batteryLevel,
                isMoving: loc.isMoving,
                recordedAt: loc.recordedAt ? new Date(loc.recordedAt) : new Date()
            })))

            return NextResponse.json({ 
                success: true, 
                message: `Saved ${count} locations`,
                count
            })
        }

        // Handle single location
        await locationService.saveLocation(userId, {
            latitude: body.latitude,
            longitude: body.longitude,
            accuracy: body.accuracy,
            altitude: body.altitude,
            speed: body.speed,
            heading: body.heading,
            batteryLevel: body.batteryLevel,
            isMoving: body.isMoving,
            recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date()
        })

        return NextResponse.json({ success: true, message: 'Location saved' })

    } catch (error: any) {
        console.error('Error saving location:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
