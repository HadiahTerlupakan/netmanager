import { apiSuccess } from '@/lib/api-response';

export async function GET() {
    return apiSuccess({ timestamp: Date.now() }, { message: 'pong' });
}
