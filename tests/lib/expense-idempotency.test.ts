import { describe, expect, it } from 'vitest'

import {
  beginExpenseMutation,
  buildExpensePayloadHash,
  completeExpenseMutation,
  __resetExpenseIdempotencyStoreForTests,
} from '@/modules/finance/services/expense-idempotency'

describe('expense idempotency', () => {
  it('returns replay when same key and same payload is completed', () => {
    __resetExpenseIdempotencyStoreForTests()

    const key = 'idem-a'
    const userId = 'user-1'
    const action = 'create'
    const payloadHash = buildExpensePayloadHash({ amount: '10000', category: 'OPEX' })

    const first = beginExpenseMutation({ action, key, userId, payloadHash })
    expect(first.status).toBe('started')

    const response = { id: 'exp-1', amount: '10000' }
    completeExpenseMutation({ action, key, userId, payloadHash, response })

    const second = beginExpenseMutation({ action, key, userId, payloadHash })
    expect(second.status).toBe('replay')
    expect(second.response).toEqual(response)
  })

  it('returns hash-mismatch when same key is used with different payload', () => {
    __resetExpenseIdempotencyStoreForTests()

    const key = 'idem-b'
    const userId = 'user-1'
    const action = 'batch-create'
    const payloadHashA = buildExpensePayloadHash({ amount: '10000', category: 'OPEX' })
    const payloadHashB = buildExpensePayloadHash({ amount: '10001', category: 'OPEX' })

    const first = beginExpenseMutation({ action, key, userId, payloadHash: payloadHashA })
    expect(first.status).toBe('started')

    const second = beginExpenseMutation({ action, key, userId, payloadHash: payloadHashB })
    expect(second.status).toBe('hash-mismatch')
  })
})
