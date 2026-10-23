import { isPrismaRecordNotFoundError } from '@/lib/prisma-errors'
import {
  CompanyBankAccountRepository,
  type CompanyBankAccountInput,
} from '../repositories/CompanyBankAccountRepository'

type ServiceResult<T> = {
  success: boolean
  data?: T
  error?: string
  code?: 'NOT_FOUND' | 'FETCH_ERROR' | 'CREATE_ERROR' | 'UPDATE_ERROR' | 'DELETE_ERROR'
}

function normalizeInput(input: CompanyBankAccountInput): CompanyBankAccountInput {
  return {
    bankName: input.bankName.trim(),
    accountNumber: input.accountNumber.trim(),
    accountName: input.accountName.trim(),
    description: input.description?.trim() || null,
    isActive: input.isActive,
    priority: input.priority,
  }
}

export class CompanyBankAccountService {
  constructor(private readonly repository = new CompanyBankAccountRepository()) {}

  async listAccounts(): Promise<ServiceResult<Awaited<ReturnType<CompanyBankAccountRepository['findAll']>>>> {
    try {
      const accounts = await this.repository.findAll()
      return { success: true, data: accounts }
    } catch {
      return { success: false, error: 'Gagal mengambil daftar rekening bank', code: 'FETCH_ERROR' }
    }
  }

  async createAccount(input: CompanyBankAccountInput): Promise<ServiceResult<Awaited<ReturnType<CompanyBankAccountRepository['create']>>>> {
    try {
      const account = await this.repository.create(normalizeInput(input))
      return { success: true, data: account }
    } catch {
      return { success: false, error: 'Gagal membuat rekening bank', code: 'CREATE_ERROR' }
    }
  }

  async updateAccount(id: string, input: CompanyBankAccountInput): Promise<ServiceResult<Awaited<ReturnType<CompanyBankAccountRepository['update']>>>> {
    try {
      const existing = await this.repository.findById(id)
      if (!existing) {
        return { success: false, error: 'Rekening bank tidak ditemukan', code: 'NOT_FOUND' }
      }

      const account = await this.repository.update(id, normalizeInput(input))
      return { success: true, data: account }
    } catch (error) {
      if (isPrismaRecordNotFoundError(error)) {
        return { success: false, error: 'Rekening bank tidak ditemukan', code: 'NOT_FOUND' }
      }

      return { success: false, error: 'Gagal memperbarui rekening bank', code: 'UPDATE_ERROR' }
    }
  }

  async deleteAccount(id: string): Promise<ServiceResult<void>> {
    try {
      const existing = await this.repository.findById(id)
      if (!existing) {
        return { success: false, error: 'Rekening bank tidak ditemukan', code: 'NOT_FOUND' }
      }

      await this.repository.delete(id)
      return { success: true }
    } catch (error) {
      if (isPrismaRecordNotFoundError(error)) {
        return { success: false, error: 'Rekening bank tidak ditemukan', code: 'NOT_FOUND' }
      }

      return { success: false, error: 'Gagal menghapus rekening bank', code: 'DELETE_ERROR' }
    }
  }
}

let companyBankAccountService: CompanyBankAccountService | null = null

export function getCompanyBankAccountService(): CompanyBankAccountService {
  if (!companyBankAccountService) {
    companyBankAccountService = new CompanyBankAccountService()
  }

  return companyBankAccountService
}
