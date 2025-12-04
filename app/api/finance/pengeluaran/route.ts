import { NextRequest, NextResponse } from 'next/server'
import { getPengeluaranRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import FinanceAuthService from '@/lib/services/FinanceAuthService'
import { withQueryValidation, withValidation, financeQuerySchema, financePengeluaranSchema } from '@/lib/validation/middleware'
import { createSuccessResponse, handleApiError, createAuthError } from '@/lib/utils/secure-error-handler'

/**
 * GET /api/finance/pengeluaran
 * List semua pengeluaran untuk finance (FINANCE atau ADMIN)
 */
export const GET = withQueryValidation(
  financeQuerySchema,
  async (request, { query }) => {
    try {
      // Authenticate using secure FinanceAuthService
      const authResult = await FinanceAuthService.authenticate(request)

      if (!authResult.success) {
        return createAuthError()
      }

      const pengeluaranRepo = getPengeluaranRepository()

      // Extract query parameters with validation
      const { page, limit, search, startDate, endDate, sortBy, sortOrder, kategori } = query

      let filter: any = {}

      if (startDate || endDate) {
        filter.tanggal = {}
        if (startDate) filter.tanggal.gte = startDate
        if (endDate) filter.tanggal.lte = endDate
      }

      if (kategori) {
        filter.kategori = kategori
      }

      if (search) {
        filter.OR = [
          { deskripsi: { contains: search } },
          { kategori: { contains: search } }
        ]
      }

      // Get pengeluaran with pagination
      const items = await pengeluaranRepo.getMany({
        filter,
        orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })

      // Get total count for pagination
      const total = await pengeluaranRepo.count({ filter })

      return createSuccessResponse({
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      })

    } catch (error) {
      return handleApiError(error, {
        method: 'GET',
        url: request.url,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent')
      })
    }
  }
)

/**
 * POST /api/finance/pengeluaran
 * Create pengeluaran baru (FINANCE atau ADMIN)
 */
export const POST = withValidation(
  financePengeluaranSchema,
  async (request, { data }) => {
    try {
      // Authenticate using secure FinanceAuthService
      const authResult = await FinanceAuthService.authenticate(request)

      if (!authResult.success) {
        return createAuthError()
      }

      const userId = authResult.user!.id
      const pengeluaranRepo = getPengeluaranRepository()

      // Check for duplicate nomor bukti if provided
      if (data.nomorBukti) {
        const existingExpense = await (prisma as any).pengeluaran.findFirst({
          where: {
            nomorBukti: data.nomorBukti,
          },
        })

        if (existingExpense) {
          return handleApiError(
            { code: 'P2002', message: 'Duplicate nomor bukti' },
            {
              method: 'POST',
              url: request.url,
              ip: request.headers.get('x-forwarded-for') || 'unknown',
              userAgent: request.headers.get('user-agent'),
              userId
            }
          )
        }
      }

      // Create pengeluaran with audit trail
      const result = await pengeluaranRepo.create({
        ...data,
        createdBy: userId,
      })

      // Log financial access for audit
      await FinanceAuthService.logFinancialAccess(
        request,
        authResult.user!,
        'CREATE',
        'PENGELUARAN',
        {
          id: result.id,
          jumlah: data.jumlah,
          kategori: data.kategori,
          tipe: data.tipe
        }
      )

      return createSuccessResponse(
        result,
        'Pengeluaran created successfully',
        {
          id: result.id,
          createdAt: result.createdAt
        }
      )

    } catch (error) {
      return handleApiError(error, {
        method: 'POST',
        url: request.url,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent')
      })
    }
  }
)