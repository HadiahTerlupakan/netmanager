import { prisma } from '@/modules/database'
import type { CompanyBankAccount } from '@prisma/client'

export type CompanyBankAccountInput = {
  bankName: string
  accountNumber: string
  accountName: string
  description?: string | null
  isActive: boolean
  priority: number
}

export class CompanyBankAccountRepository {
  async findAll(): Promise<CompanyBankAccount[]> {
    return prisma.companyBankAccount.findMany({
      orderBy: { priority: 'asc' },
    })
  }

  async findById(id: string): Promise<CompanyBankAccount | null> {
    return prisma.companyBankAccount.findUnique({ where: { id } })
  }

  async create(data: CompanyBankAccountInput): Promise<CompanyBankAccount> {
    return prisma.companyBankAccount.create({
      data: {
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        description: data.description ?? null,
        isActive: data.isActive,
        priority: data.priority,
      },
    })
  }

  async update(id: string, data: CompanyBankAccountInput): Promise<CompanyBankAccount> {
    return prisma.companyBankAccount.update({
      where: { id },
      data: {
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        description: data.description ?? null,
        isActive: data.isActive,
        priority: data.priority,
      },
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.companyBankAccount.delete({ where: { id } })
  }
}
