import { NextRequest, NextResponse } from 'next/server';
import { getMobileAuthPayload } from '@/lib/mobile-api-auth';
import { prismaMitra } from '@/modules/database';
import fs from 'fs';
import path from 'path';
import { apiError, ErrorCodes } from '@/lib/api-response'
import { logActivitySafe } from '@/lib/logger';

export async function POST(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request);
        if (authResult instanceof NextResponse) {
            return authResult;
        }

        const payload = authResult

        if (payload.role !== 'MITRA') {
            return apiError('Akses ditolak. Fitur ini hanya untuk Mitra.', ErrorCodes.FORBIDDEN, { status: 403 });
        }

        const userId = payload.id as string;
        const tenantId = payload.tenantId;

        // 2. Parse Multipart form data
        const formData = await request.formData();
        const photo = formData.get('photo') as File | null;

        if (!photo) {
            return apiError('Foto tidak ditemukan', ErrorCodes.VALIDATION_ERROR, { status: 400 });
        }

        // 3. Save the photo
        const bytes = await photo.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Sanitize and create path
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'mitra');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const timestamp = Date.now();
        const extension = photo.name.split('.').pop() || 'jpg';
        const filename = `face_verification_${userId}_${timestamp}.${extension}`;
        const filepath = path.join(uploadsDir, filename);
        const fileUrl = `/uploads/mitra/${filename}`;

        // Save to /public/uploads/mitra/
        fs.writeFileSync(filepath, buffer);

        // 4. Update Database — also log the verification event
        await prismaMitra.$transaction([
            prismaMitra.mitra.update({
                where: { id: userId },
                data: {
                    requiresFaceVerification: false,
                    lastFaceVerification: new Date(),
                    fotoDiri: fileUrl
                }
            }),
            prismaMitra.faceVerificationLog.create({
                data: {
                    mitraId: userId,
                    photoUrl: fileUrl,
                }
            }),
        ]);

        // 5. System Log Audit
        logActivitySafe({
            action: 'UPDATE',
            subject: 'Face Verification',
            userId: null, // Mitra ID is not in User table
            tenantId: tenantId,
            details: { 
                mitraId: userId, 
                action: 'FACE_VERIFY_MOBILE', 
                photoUrl: fileUrl,
                status: 'SUCCESS'
            }
        });

        // 6. Response
        return NextResponse.json({
            success: true,
            data: {
                message: 'Verifikasi wajah berhasil',
                url: fileUrl,
                verifiedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Face Verification Error:', error);
        return apiError('Terjadi kesalahan sistem.', ErrorCodes.INTERNAL_ERROR, { status: 500 });
    }
}
