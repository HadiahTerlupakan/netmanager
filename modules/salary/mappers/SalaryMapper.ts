/**
 * SalaryMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { Salary, SalaryDetail, SalaryComponent } from '@prisma/client'
import type {
    SalaryListItemDTO,
    SalaryDetailDTO,
    SalaryDetailItemDTO,
    SalaryComponentDTO,
    SalarySlipDTO,
} from '../dto/SalaryDTO'

// Extended types
type SalaryWithRelations = Salary & {
    user?: {
        id: string
        name: string | null
        email: string
    }
    auditedBy?: {
        id: string
        name: string | null
    } | null
    approvedBy?: {
        id: string
        name: string | null
    } | null
    details?: SalaryDetail[]
}

export class SalaryMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: SalaryWithRelations): SalaryListItemDTO {
        return {
            id: entity.id,
            employeeName: entity.user?.name ?? null,
            employeeEmail: entity.user?.email ?? '',
            month: entity.month,
            year: entity.year,
            period: this.formatPeriod(entity.month, entity.year),
            status: entity.status,
            basicSalary: entity.basicSalary,
            totalEarnings: entity.totalEarnings,
            totalDeductions: entity.totalDeductions,
            netSalary: entity.netSalary,
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: SalaryWithRelations[]): SalaryListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: SalaryWithRelations): SalaryDetailDTO {
        return {
            id: entity.id,
            month: entity.month,
            year: entity.year,
            period: this.formatPeriod(entity.month, entity.year),
            status: entity.status,
            basicSalary: entity.basicSalary,
            totalEarnings: entity.totalEarnings,
            totalDeductions: entity.totalDeductions,
            netSalary: entity.netSalary,
            calculatedAt: entity.calculatedAt?.toISOString() ?? null,
            auditedAt: entity.auditedAt?.toISOString() ?? null,
            auditNotes: entity.auditNotes,
            approvedAt: entity.approvedAt?.toISOString() ?? null,
            paidAt: entity.paidAt?.toISOString() ?? null,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            employee: {
                id: entity.user?.id ?? entity.userId,
                name: entity.user?.name ?? null,
                email: entity.user?.email ?? '',
            },
            auditedBy: entity.auditedBy ? {
                id: entity.auditedBy.id,
                name: entity.auditedBy.name,
            } : null,
            approvedBy: entity.approvedBy ? {
                id: entity.approvedBy.id,
                name: entity.approvedBy.name,
            } : null,
            details: this.mapDetails(entity.details ?? []),
        }
    }

    /**
     * Map to salary slip DTO (employee view)
     */
    static toSlip(entity: SalaryWithRelations): SalarySlipDTO {
        const details = entity.details ?? []
        const earnings = details.filter(d => d.type === 'EARNING')
        const deductions = details.filter(d => d.type === 'DEDUCTION')

        return {
            id: entity.id,
            period: this.formatPeriod(entity.month, entity.year),
            employee: {
                name: entity.user?.name ?? null,
                email: entity.user?.email ?? '',
            },
            basicSalary: entity.basicSalary,
            earnings: this.mapDetails(earnings),
            deductions: this.mapDetails(deductions),
            totalEarnings: entity.totalEarnings,
            totalDeductions: entity.totalDeductions,
            netSalary: entity.netSalary,
            paidAt: entity.paidAt?.toISOString() ?? null,
        }
    }

    /**
     * Map salary component
     */
    static componentToDTO(entity: SalaryComponent): SalaryComponentDTO {
        return {
            id: entity.id,
            name: entity.name,
            type: entity.type,
            rateType: entity.rateType,
            defaultAmount: entity.defaultAmount,
            description: entity.description,
            isActive: entity.isActive,
            sortOrder: entity.sortOrder,
        }
    }

    /**
     * Map components to DTOs
     */
    static componentsToDTO(entities: SalaryComponent[]): SalaryComponentDTO[] {
        return entities.map(entity => this.componentToDTO(entity))
    }

    // ==================== Private Helpers ====================

    private static mapDetails(details: SalaryDetail[]): SalaryDetailItemDTO[] {
        return details.map(detail => ({
            id: detail.id,
            name: detail.name,
            type: detail.type,
            quantity: detail.quantity,
            rate: detail.rate,
            amount: detail.amount,
            notes: detail.notes,
        }))
    }

    private static formatPeriod(month: number, year: number): string {
        const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ]
        return `${monthNames[month - 1]} ${year}`
    }
}
