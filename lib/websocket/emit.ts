
/**
 * Helper to emit socket events from API routes or Services
 * bypassing the need to have direct access to io instance
 */
export async function emitSocketEvent(room: string, event: string, payload: unknown) {
    const port = process.env.PORT || '3000'
    const url = `http://127.0.0.1:${port}/_internal/emit`
    
    try {
        // Use fetch without awaiting response to not block execution? 
        // Better to await but catch error to not fail request
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: process.env.INTERNAL_WS_SECRET || 'netmanager-ws-internal-2024',
                room,
                event,
                payload
            })
        })
        
        if (!response.ok) {
            console.warn(`[Socket Emit] Failed to emit ${event} to ${room}: ${response.status}`)
        }
    } catch (error) {
        console.error(`[Socket Emit] Error emitting ${event} to ${room}:`, error)
    }
}
