import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { prismaMitra } from '@/lib/prisma-mitra';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
    try {
        // 1. Verify User Session
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Format token tidak valid' }, { status: 401 });
        }

        const payload = await verifyMobileToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
        }

        if (payload.role !== 'MITRA') {
            return NextResponse.json({ error: 'Akses ditolak. Fitur ini hanya untuk Mitra.' }, { status: 403 });
        }

        // 2. Parse Multipart form data
        const formData = await request.formData();
        const photo = formData.get('photo') as File | null;

        if (!photo) {
            return NextResponse.json({ error: 'Foto tidak ditemukan' }, { status: 400 });
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
        const filename = `face_verification_${payload.id}_${timestamp}.${extension}`;
        const filepath = path.join(uploadsDir, filename);
        const fileUrl = `/uploads/mitra/${filename}`;

        // Save to /public/uploads/mitra/
        fs.writeFileSync(filepath, buffer);

        // 4. Update Database — also log the verification event
        await prismaMitra.$transaction([
            prismaMitra.mitra.update({
                where: { id: payload.id as string },
                data: {
                    requiresFaceVerification: false,
                    lastFaceVerification: new Date(),
                    fotoDiri: fileUrl
                }
            }),
            prismaMitra.faceVerificationLog.create({
                data: {
                    mitraId: payload.id as string,
                    photoUrl: fileUrl,
                }
            }),
        ]);

        // 5. Response
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
        return NextResponse.json({ error: 'Terjadi kesalahan sistem.' }, { status: 500 });
    }
}
