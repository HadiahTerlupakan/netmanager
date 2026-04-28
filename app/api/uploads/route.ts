import { logger } from "@/lib/logger";
import { NextRequest } from 'next/server'
import { apiError, apiSuccess, ErrorCodes } from '@/lib/api-response'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { supportTicketUploadService } from '@/modules/pelanggan'
import type { SupportTicketUploadResult } from '@/modules/pelanggan'

type SupportTicketUploadSuccess = Extract<SupportTicketUploadResult, { ok: true }>

function isUploadSuccess(result: SupportTicketUploadResult): result is SupportTicketUploadSuccess {
    return result.ok
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig)

        if (!session?.user?.id) {
            return apiError('Unauthorized', ErrorCodes.UNAUTHORIZED, { status: 401 })
        }

        const formData = await request.formData()
        const result = await supportTicketUploadService.upload(formData.get('file') as File | null)

        if (isUploadSuccess(result)) {
            return apiSuccess(result.data)
        }

        return apiError(result.message, ErrorCodes.VALIDATION_ERROR, { status: result.status })

    } catch (error) {
        logger.error('Upload error:', error)
        return apiError('Failed to upload file', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}

export const config = {
    api: {
        bodyParser: false,
    },
}
