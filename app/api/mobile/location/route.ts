import { NextRequest, NextResponse } from 'next/server'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { LocationTrackingService } from '@/modules/attendance/services/LocationTrackingService'

/**
 * POST /api/mobile/location
 * Menerima update lokasi dari mobile app
 * Hanya menyimpan jika user sedang dalam status check-in
 */
export async function POST(request: NextRequest) {
    const timestamp = new Date().toISOString()
    try {
        const authHeader = request.headers.get('Authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log(`[API][${timestamp}] Location update: Missing token`)
            return NextResponse.json({ error: 'Missing or invalid token' }, { status: 401 })
        }

        const token = authHeader.split(" ")[1]
        if (!token) {
            return NextResponse.json({ error: "Token not provided" }, { status: 401 })
        }
        const payload = await verifyMobileToken(token)
        if (!payload) {
            console.log(`[API][${timestamp}] Location update: Invalid token`)
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
        }

        const userId = payload.id as string
        const body = await request.json()

        console.log(`[API][${timestamp}] ========== LOCATION UPDATE ==========`)
        console.log(`[API][${timestamp}] User ID: ${userId}`)
        console.log(`[API][${timestamp}] Data received:`, JSON.stringify(body))

        const locationService = new LocationTrackingService()

        // Cek apakah user sedang check-in
        const isCheckedIn = await locationService.isUserCurrentlyCheckedIn(userId)
        console.log(`[API][${timestamp}] User check-in status: ${isCheckedIn}`)

        if (!isCheckedIn) {
            console.log(`[API][${timestamp}] ❌ User not checked in, stopping tracking`)
            return NextResponse.json({ 
                success: false, 
                message: 'User is not currently checked in',
                shouldStopTracking: true 
            })
        }

        // Handle batch locations (offline sync)
        if (Array.isArray(body.locations)) {
            console.log(`[API][${timestamp}] Processing batch of ${body.locations.length} locations`)
            const count = await locationService.saveLocations(userId, body.locations.map((loc: Record<string, unknown>) => ({
                latitude: loc.latitude,
                longitude: loc.longitude,
                accuracy: loc.accuracy,
                altitude: loc.altitude,
                speed: loc.speed,
                heading: loc.heading,
                batteryLevel: loc.batteryLevel,
                isMoving: loc.isMoving,
                recordedAt: loc.recordedAt ? new Date(loc.recordedAt as string) : new Date()
            })))

            console.log(`[API][${timestamp}] ✅ Batch saved: ${count} locations`)
            return NextResponse.json({ 
                success: true, 
                message: `Saved ${count} locations`,
                count
            })
        }

        // Handle single location
        console.log(`[API][${timestamp}] Saving single location...`)
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

        console.log(`[API][${timestamp}] ✅ Single location saved successfully`)
        console.log(`[API][${timestamp}] ==========================================`)
        return NextResponse.json({ success: true, message: 'Location saved' })

    } catch (error: unknown) {
        console.error(`[API][${timestamp}] ❌ Error saving location:`, error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
