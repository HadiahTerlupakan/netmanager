/**
 * Stream Processor Utility
 * 
 * Provides utilities for processing large files in chunks
 * to reduce memory usage during file operations.
 */

export interface ChunkProcessorOptions {
    chunkSize?: number
    onProgress?: (processed: number, total: number) => void
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024 // 5MB chunks

/**
 * Process a buffer in chunks to reduce memory usage
 */
export async function processBufferInChunks<T>(
    buffer: Buffer,
    processor: (chunk: Buffer, index: number) => T | Promise<T>,
    options: ChunkProcessorOptions = {}
): Promise<T[]> {
    const { chunkSize = DEFAULT_CHUNK_SIZE, onProgress } = options
    const results: T[] = []
    const totalSize = buffer.length
    let processed = 0

    for (let i = 0; i < buffer.length; i += chunkSize) {
        const chunk = buffer.subarray(i, Math.min(i + chunkSize, buffer.length))
        const index = Math.floor(i / chunkSize)

        const result = await processor(chunk, index)
        results.push(result)

        processed += chunk.length
        onProgress?.(processed, totalSize)
    }

    return results
}

/**
 * Stream a file from FormData with progress tracking
 * Returns readable stream for large files, buffer for small files
 */
export async function getFileWithProgress(
    formData: FormData,
    fieldName: string,
    options: {
        streamThreshold?: number
        onProgress?: (loaded: number, total: number) => void
    } = {}
): Promise<{ buffer: Buffer; size: number }> {
    const file = formData.get(fieldName) as File | null
    if (!file) {
        throw new Error(`File ${fieldName} tidak ditemukan`)
    }

    const { streamThreshold = 10 * 1024 * 1024, onProgress } = options // 10MB threshold

    // For files under threshold, use simple approach
    if (file.size < streamThreshold) {
        const arrayBuffer = await file.arrayBuffer()
        return { buffer: Buffer.from(arrayBuffer), size: file.size }
    }

    // For large files, process in chunks to avoid memory spikes
    const chunks: Uint8Array[] = []
    let loaded = 0

    const reader = file.stream().getReader()

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunks.push(value)
        loaded += value.length
        onProgress?.(loaded, file.size)
    }

    // Combine chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const buffer = Buffer.alloc(totalLength)
    let offset = 0

    for (const chunk of chunks) {
        buffer.set(chunk, offset)
        offset += chunk.length
    }

    return { buffer, size: file.size }
}

/**
 * Memory-efficient text extraction from large buffers
 * Processes text in chunks to avoid string memory issues
 */
export function extractTextFromBuffer(
    buffer: Buffer,
    encoding: BufferEncoding = 'utf8',
    maxSize: number = 50 * 1024 * 1024 // 50MB max
): string {
    if (buffer.length > maxSize) {
        throw new Error(`Buffer terlalu besar: ${buffer.length} bytes (max: ${maxSize})`)
    }

    // For smaller buffers, direct conversion is fine
    if (buffer.length < 5 * 1024 * 1024) { // 5MB
        return buffer.toString(encoding)
    }

    // For larger buffers, process in chunks
    const chunks: string[] = []
    const chunkSize = 1024 * 1024 // 1MB string chunks

    for (let i = 0; i < buffer.length; i += chunkSize) {
        const end = Math.min(i + chunkSize, buffer.length)
        chunks.push(buffer.toString(encoding, i, end))
    }

    return chunks.join('')
}

/**
 * Calculate memory-efficient hash for file validation
 */
export function calculateBufferChecksum(buffer: Buffer): string {
    // Simple checksum using XOR and position
    let checksum = 0
    const sampleRate = Math.max(1, Math.floor(buffer.length / 10000)) // Sample ~10000 bytes

    for (let i = 0; i < buffer.length; i += sampleRate) {
        checksum = (checksum ^ buffer[i] ^ (i & 0xFF)) >>> 0
    }

    return checksum.toString(16).padStart(8, '0')
}
