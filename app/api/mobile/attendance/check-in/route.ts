import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { AttendanceService } from '@/modules/attendance/services/AttendanceService'
import { verifySignature } from '@/lib/crypto'
// DEBUG LOGGER (Console version to avoid build/fs issues)
const log = (msg: string, data?: any) => {
    const prefix = '[DEBUG_ATTENDANCE]';
    if (data) {
        console.log(prefix + ' ' + msg);
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.log(prefix + ' ' + msg);
    }
};
// HolidayRepository no longer needed directly as Service handles validation
// import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    try {
        log('Request received');
        const authHeader = request.headers.get('authorization')
        log('Auth Header present:', !!authHeader);

        if (!authHeader?.startsWith('Bearer ')) {
            log('Invalid auth header');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const decoded = await verifyMobileToken(token)

        if (!decoded) {
            log('Token verification failed');
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const userId = decoded.userId as string
        log('User ID:', userId);

        // Fetch User and Settings first to determine Timezone
        const [userDetails, toleranceSetting, timezoneSetting] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    startWorkTime: true,
                    endWorkTime: true,
                    workingHourMode: true
                }
            }),
            prisma.settings.findFirst({
                where: { key: 'GENERAL_ATTENDANCE_TOLERANCE' }
            }),
            prisma.settings.findFirst({
                where: { key: 'GENERAL_TIMEZONE' }
            })
        ])

        const timezone = timezoneSetting?.value || 'Asia/Jakarta'
        const toleranceMinutes = toleranceSetting?.value ? parseInt(toleranceSetting.value) : 0


        // Logic continues with request parsing...



        // Initialize optional fields
        let photoUrl = null
        let location = ''
        let notes = ''
        let latitude: number | undefined
        let longitude: number | undefined
        let offlineCapturedAt: Date | undefined
        
        const contentType = request.headers.get('content-type') || ''
        log('Content-Type:', contentType);
        
        if (contentType.includes('multipart/form-data')) {
            const formData: any = await request.formData()
            log('Processing FormData');

            const photo = formData.get('photo') as File
            location = formData.get('location') as string
            notes = formData.get('notes') as string
            const latStr = formData.get('latitude') as string
            const lngStr = formData.get('longitude') as string

            if (latStr && lngStr) {
                latitude = parseFloat(latStr)
                longitude = parseFloat(lngStr)
            }
            
            // Check for offline meta in FormData (JSON string usually)
            const metaStr = formData.get('_offline_meta') as string
            if (metaStr) {
                try {
                    const meta = JSON.parse(metaStr)
                    if (meta.capturedAt) {
                        const dt = new Date(meta.capturedAt)
                        if (!isNaN(dt.getTime())) {
                             offlineCapturedAt = dt
                             
                             // Verify Signature for FormData
                             if (meta.signature) {
                                  const dataToVerify = {
                                      userId,
                                      timestamp: meta.capturedAt,
                                      latitude,
                                      longitude
                                  }
                                  log('Verifying Offline Signature (FormData)', dataToVerify);
                                  if (!verifySignature(dataToVerify, meta.signature)) {
                                      log('Signature Invalid (FormData)');
                                      return NextResponse.json({ error: 'Invalid offline data signature' }, { status: 400 })
                                  }
                                  log('Signature Valid (FormData)');
                             } else {
                                  return NextResponse.json({ error: 'Offline data must be signed' }, { status: 400 })
                             }
                        }
                    }
                } catch (e) { 
                    log('Error parse offline meta', e);
                }
            }
            
            if (photo) {
                if (!photo.type.startsWith('image/')) {
                    return NextResponse.json({ error: 'File harus berupa gambar' }, { status: 400 });
                }

                const MAX_SIZE = 5 * 1024 * 1024; // 5MB
                if (photo.size > MAX_SIZE) {
                    return NextResponse.json({ error: 'Ukuran foto maksimal 5MB' }, { status: 400 });
                }

                const dateStr = new Date().toISOString().split('T')[0];
                const uploadDir = 'public/uploads/attendance/' + dateStr;
                const fileName = userId + '_checkin_' + Date.now();

                // NOTE: image conversion logic removed/commented out
                // photoUrl = await convertAndSaveImage(...)
                
                photoUrl = (formData.get('photoUrl') as string) || null;
            }
        } else if (contentType.includes('application/json')) {
            const body = await request.json()
            log('Processing JSON Body', body);
            photoUrl = body.photoUrl
            location = body.location
            notes = body.notes
            latitude = body.latitude
            longitude = body.longitude
            
            // Check for offline meta
            if (body._offline_meta && body._offline_meta.capturedAt) {
                const dt = new Date(body._offline_meta.capturedAt)
                if (!isNaN(dt.getTime())) {
                    offlineCapturedAt = dt
                    
                    // Verify Signature
                    if (body._offline_meta.signature) {
                        const dataToVerify = {
                            userId,
                            timestamp: body._offline_meta.capturedAt,
                            latitude: latitude,
                            longitude: longitude
                        }
                        log('Verifying Offline Signature (JSON)', dataToVerify);
                        if (!verifySignature(dataToVerify, body._offline_meta.signature)) {
                             log('Signature Invalid (JSON)');
                             return NextResponse.json({ error: 'Invalid offline data signature' }, { status: 400 })
                        }
                        log('Signature Valid (JSON)');
                    } else {
                        // Optional: Reject unsigned offline data?
                        // For legacy compatibility, maybe log warning or allow if config says so.
                        // For now we enforce if _offline_meta is present.
                         return NextResponse.json({ error: 'Offline data must be signed' }, { status: 400 })
                    }
                }
            } else if (body.capturedAt) {
                 const dt = new Date(body.capturedAt)
                 if (!isNaN(dt.getTime())) offlineCapturedAt = dt
            }
        }

        // --- Use Centralized Service ---
        const attendanceService = new AttendanceService()
        log('Calling service checkIn...');
        const attendance = await attendanceService.checkIn({
            userId,
            photoUrl,
            location,
            notes,
            latitude,
            longitude,
            offlineTime: offlineCapturedAt,
            timezone // Use fetched user timezone preference
        })
        log('Service checkIn success', attendance);
        
        logger.apiRequest('POST', '/api/mobile/attendance/check-in', 201, Date.now() - startTime, {
            userId,
            attendanceId: attendance.id,
            status: attendance.status
        })

        return NextResponse.json({ success: true, data: attendance })

    } catch (error: any) {
        log('Error in checkIn route', error.message);
        console.error('Check-in error:', error)
        if (error.message === 'DUPLICATE_ENTRY') {
            return NextResponse.json({ error: 'Anda sudah melakukan check-in hari ini' }, { status: 400 })
        }
        if (error.message.startsWith('CHECKIN_REJECTED:')) {
            const reason = error.message.split(':')[1]
            return NextResponse.json({ 
                error: `Check-in ditolak: ${reason}`,
                code: 'VALIDATION_ERROR' 
            }, { status: 400 })
        }

        logger.error('Error in mobile check-in', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
