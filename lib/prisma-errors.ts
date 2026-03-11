export function isPrismaRecordNotFoundError(error: unknown): error is Error & { code?: string } {
    return Boolean(
        error
        && typeof error === 'object'
        && 'code' in error
        && (error as { code?: string }).code === 'P2025'
    )
}
