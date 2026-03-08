export type ResetResult = {
    database: string
    status: 'success' | 'skipped' | 'error'
    message: string
}

export function shouldRunSeedAfterReset(results: ResetResult[]): boolean {
    if (results.length === 0) {
        return false
    }

    return results.every((result) => result.status === 'success')
}
