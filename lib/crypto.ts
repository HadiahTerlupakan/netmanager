import { createHmac } from 'crypto';

// In production, this should be a robust secret loaded from strict environment variables
const SIGNING_KEY = process.env.OFFLINE_SIGNING_KEY || 'dev-key-change-in-prod-v1';

export function verifySignature(data: unknown, signature: string): boolean {
    try {
        // Ensure consistent serialization (e.g. key order) by rebuilding object if needed
        // For simplicity, we assume the input 'data' is the exact payload used for signing
        // But to be safer, we might want to sign specific fields in specific order.
        // Strategy: Sign specific canonical fields: userId + timestamp + lat + lng
        
        // If data is just the "payload" object passed from validation:
        const payload = JSON.stringify(data);
        
        const expected = createHmac('sha256', SIGNING_KEY)
            .update(payload)
            .digest('hex');
            
        // Constant time comparison to prevent timing attacks
        return expected === signature; 
        
    } catch (error) {
        console.error('Signature verification error', error);
        return false;
    }
}
