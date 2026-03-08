import { NextRequest, NextResponse } from 'next/server';
import { getMobileAuthPayload } from '@/lib/mobile-api-auth';
import { convertAndSaveImage, isImageFile } from '@/lib/utils/image-upload';
import type { UploadType } from '@/lib/utils/image-upload';
import path from 'path';

/**
 * POST /api/mobile/upload
 * Mobile file upload endpoint with token auth
 */
export async function POST(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request);
        if (authResult instanceof NextResponse) {
            return authResult;
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const type = (formData.get('type') as UploadType) || 'general';
        const subFolder = formData.get('subFolder') as string || undefined;
        const watermarkLinesStr = formData.get('watermarkLines') as string | null;
        
        let watermarkLines: string[] | undefined;
        if (watermarkLinesStr) {
             try {
                 watermarkLines = JSON.parse(watermarkLinesStr);
             } catch (e) {
                 console.warn('Invalid watermark lines JSON', e);
             }
        }

        // Validate required fields
        if (!file) {
            return NextResponse.json({ error: 'File wajib diisi' }, { status: 400 });
        }

        // Validate file is an image
        if (!isImageFile(file)) {
            return NextResponse.json({ error: 'Hanya file gambar yang diperbolehkan' }, { status: 400 });
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            return NextResponse.json({ error: 'Ukuran file melebihi batas 10MB' }, { status: 400 });
        }

        // Generate filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const fileName = `${timestamp}_${randomStr}`;

        // Determine upload directory based on type
        let uploadDir: string;
        switch (type) {
            case 'inventory-masuk':
                uploadDir = path.join(process.cwd(), 'public', 'uploads', 'inventory', 'masuk');
                break;
            case 'inventory-keluar':
                uploadDir = path.join(process.cwd(), 'public', 'uploads', 'inventory', 'keluar');
                break;
            case 'employee-attendance':
                uploadDir = path.join(process.cwd(), 'public', 'uploads', 'employee', 'attendance');
                break;
            case 'work-order-updates':
                uploadDir = path.join(process.cwd(), 'public', 'uploads', 'workorder', 'updates');
                break;
            case 'workorder-completion':
                uploadDir = path.join(process.cwd(), 'public', 'uploads', 'workorder', 'completion');
                break;
            case 'marketing':
                uploadDir = path.join(process.cwd(), 'public', 'uploads', 'marketing', 'canvasing');
                break;
            default:
                uploadDir = path.join(process.cwd(), 'public', 'uploads', 'mobile', 'general');
        }

        // If subFolder, append to path
        if (subFolder) {
            uploadDir = path.join(uploadDir, subFolder);
        }

        // Upload and convert image
        const url = await convertAndSaveImage(
            file,
            uploadDir,
            fileName,
            type ?? undefined,
            subFolder,
            watermarkLines
        );

        // Construct absolute URL
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host');
        const baseUrl = `${protocol}://${host}`;
        const absoluteUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

        return NextResponse.json({
            success: true,
            url: absoluteUrl,
            fileName: `${fileName}.webp`
        });

    } catch (error: unknown) {
        console.error('Mobile upload error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to upload file' },
            { status: 500 }
        );
    }
}
