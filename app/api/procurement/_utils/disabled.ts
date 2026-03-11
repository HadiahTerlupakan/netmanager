import { NextResponse } from 'next/server'

const DISABLED_MESSAGE = 'Endpoint procurement dinonaktifkan'

export function procurementEndpointDisabled() {
  return NextResponse.json({ error: DISABLED_MESSAGE }, { status: 410 })
}
