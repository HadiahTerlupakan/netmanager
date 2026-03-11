import { procurementEndpointDisabled } from '@/app/api/procurement/_utils/disabled'

export async function GET() {
    return procurementEndpointDisabled()
}
