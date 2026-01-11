import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { convertAndSaveImage, isImageFile } from '@/lib/utils/image-upload';
import type { UploadType } from '@/lib/utils/image-upload';
import path from 'path';

/**
 * POST /api/mobile/upload
 * Mobile file upload endpoint with token auth
 */
export async function POST(request: NextRequest) {
    try {
        // Check mobile authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const payload = await verifyMobileToken(token);

        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const formData: any = await request.formData();
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
            return NextResponse.json({ error: 'File is required' }, { status: 400 });
        }

        // Validate file is an image
        if (!isImageFile(file)) {
            return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
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

        return NextResponse.json({
            success: true,
            url,
            fileName: `${fileName}.webp`
        });

    } catch (error: any) {
        console.error('Mobile upload error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to upload file' },
            { status: 500 }
        );
    }
}
