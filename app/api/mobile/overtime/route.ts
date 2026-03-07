import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { OvertimeService } from '@/modules/overtime';
import { convertAndSaveBase64 } from '@/lib/utils/image-upload';
import { prisma } from '@/lib/prisma';
import { toStartOfDay } from '@/lib/utils/datetime'


// GET - Get user's overtime history
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Token tidak tersedia' }, { status: 401 });
        }
        const payload = await verifyMobileToken(token);

        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
        }

        const userId = payload.id as string;
        const service = new OvertimeService();
        const history = await service.getHistory(userId);

        // Check if user has checked out today (for start validation)
        const today = new Date();
        today.setTime(toStartOfDay(today).getTime());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayAttendance = await prisma.attendance.findFirst({
            where: {
                userId,
                checkIn: { gte: today, lt: tomorrow }
            }
        });

        const hasCheckedOut = todayAttendance?.checkOut !== null;

        // Check if today is a holiday
        const holidayRecord = await prisma.holiday.findFirst({
            where: {
                date: { gte: today, lt: tomorrow }
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
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Token tidak tersedia' }, { status: 401 });
        }
        const payload = await verifyMobileToken(token);

        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
        }

        const userId = payload.id as string;
        const body = await request.json();
        const { action } = body; // 'request' | 'start' | 'stop'
        const service = new OvertimeService();

        // Action: CREATE REQUEST
        if (!action || action === 'request') {
            const { date, reason } = body;
            if (!date || !reason) {
                return NextResponse.json({ error: 'Tanggal dan alasan wajib diisi' }, { status: 400 });
            }

            const result = await service.createRequest(userId, {
                date: new Date(date),
                reason
            });
            return NextResponse.json(result, { status: 201 });
        }

        // Action: START OVERTIME
        if (action === 'start') {
            const { overtimeId, photo, location, timestamp } = body;
            if (!overtimeId || !photo) {
                return NextResponse.json({ error: 'ID dan foto wajib diisi' }, { status: 400 });
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

            const startParams: { photo: string; location?: string; timestamp?: Date } = {
                photo: photoUrl,
                location: location as string,
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
                return NextResponse.json({ error: 'ID dan foto wajib diisi' }, { status: 400 });
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

            const stopParams: { photo: string; location?: string; timestamp?: Date } = {
                photo: photoUrl,
                location: location as string,
            };
            if (timestamp) {
                stopParams.timestamp = new Date(timestamp);
            }

            const result = await service.stopOvertime(userId, overtimeId, stopParams);
            return NextResponse.json(result);
        }

        return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });

    } catch (error: unknown) {
        console.error('Mobile Overtime POST Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Terjadi kesalahan' }, { status: 400 });
    }
}
