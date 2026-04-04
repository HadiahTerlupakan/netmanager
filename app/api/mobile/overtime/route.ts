import { NextRequest, NextResponse } from 'next/server';
import { getMobileAuthPayload } from '@/lib/mobile-api-auth';
import { OvertimeService } from '@/modules/overtime';
import { convertAndSaveBase64 } from '@/lib/utils/image-upload';
import { prisma } from '@/modules/database';
import { toStartOfDay } from '@/lib/utils/server-datetime'
import { apiError, ErrorCodes } from '@/lib/api-response'


// GET - Get user's overtime history
export async function GET(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request);
        if (authResult instanceof NextResponse) {
            return authResult;
        }

        const userId = authResult.id as string;
        const tenantId = authResult.tenantId as string;
        if (!userId) {
            return apiError('Token tidak valid', ErrorCodes.UNAUTHORIZED, { status: 401 });
        }
        const service = new OvertimeService();
        const history = await service.getHistory(userId, tenantId);

        // Check if user has checked out today (for start validation)
        const today = new Date();
        today.setTime(toStartOfDay(today).getTime());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayAttendance = await prisma.attendance.findFirst({
            where: {
                userId,
                tenantId,
                checkIn: { gte: today, lt: tomorrow }
            }
        });

        const hasCheckedOut = todayAttendance?.checkOut !== null;

        // Check if today is a holiday
        const holidayRecord = await prisma.holiday.findFirst({
            where: {
                date: { gte: today, lt: tomorrow },
                tenantId
            }
        });

        return NextResponse.json({
            history,
            hasCheckedOut,
            holidayInfo: holidayRecord ? {
                description: holidayRecord.description,
                isNational: holidayRecord.isNational
            } : null
        });
    } catch (error: unknown) {
        console.error('Mobile Overtime GET Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Terjadi kesalahan' }, { status: 500 });
    }
}

// POST - Create request / Start / Stop overtime
export async function POST(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request);
        if (authResult instanceof NextResponse) {
            return authResult;
        }

        const userId = authResult.id as string;
        const tenantId = authResult.tenantId as string;
        if (!userId) {
            return apiError('Token tidak valid', ErrorCodes.UNAUTHORIZED, { status: 401 });
        }
        const body = await request.json();
        const { action } = body; // 'request' | 'start' | 'stop'
        const service = new OvertimeService();

        // Action: CREATE REQUEST
        if (!action || action === 'request') {
            const { date, reason } = body;
            if (!date || !reason) {
                return apiError('Tanggal dan alasan wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 });
            }

            const result = await service.createRequest(userId, {
                date: new Date(date),
                reason,
                tenantId
            });
            return NextResponse.json(result, { status: 201 });
        }

        // Action: START OVERTIME
        if (action === 'start') {
            const { overtimeId, photo, location, timestamp } = body;
            if (!overtimeId || !photo) {
                return apiError('ID dan foto wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 });
            }

            // Convert Base64 photo to file/url if needed
            let photoUrl = photo;
            if (!photo.startsWith('http') && !photo.startsWith('/uploads')) {
                 const dateStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
                 const uploadDir = `public/uploads/overtime/${dateStr}`;
                 const fileName = `${userId}_start_${Date.now()}`;
    
                 photoUrl = await convertAndSaveBase64(
                    photo,
                    uploadDir,
                    fileName,
                    'employee-attendance',
                    userId
                 );
            }

            const startParams: { photo: string; location?: string; timestamp?: Date; tenantId?: string } = {
                photo: photoUrl,
                location: location as string,
                tenantId
            };
            if (timestamp) {
                startParams.timestamp = new Date(timestamp);
            }

            const result = await service.startOvertime(userId, overtimeId, startParams);
            return NextResponse.json(result);
        }

        // Action: STOP OVERTIME
        if (action === 'stop') {
            const { overtimeId, photo, location, timestamp } = body;
            if (!overtimeId || !photo) {
                return apiError('ID dan foto wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 });
            }

            // Convert Base64 photo to file/url if needed
            let photoUrl = photo;
            if (!photo.startsWith('http') && !photo.startsWith('/uploads')) {
                const dateStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
                const uploadDir = `public/uploads/overtime/${dateStr}`;
                const fileName = `${userId}_stop_${Date.now()}`;

                photoUrl = await convertAndSaveBase64(
                    photo,
                    uploadDir,
                    fileName,
                    'employee-attendance',
                    userId
                );
            }

            const stopParams: { photo: string; location?: string; timestamp?: Date; tenantId?: string } = {
                photo: photoUrl,
                location: location as string,
                tenantId
            };
            if (timestamp) {
                stopParams.timestamp = new Date(timestamp);
            }

            const result = await service.stopOvertime(userId, overtimeId, stopParams);
            return NextResponse.json(result);
        }

        return apiError('Aksi tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 });

    } catch (error: unknown) {
        console.error('Mobile Overtime POST Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Terjadi kesalahan' }, { status: 400 });
    }
}
