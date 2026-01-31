import { SalaryRepository } from '../repositories/SalaryRepository'

export class SalaryAuditService {
    private salaryRepo: SalaryRepository

    constructor() {
        this.salaryRepo = new SalaryRepository()
    }

    /**
     * Submit salary for audit (status: CALCULATED → waiting for audit)
     */
    async submitForAudit(salaryId: string): Promise<void> {
        const salary = await this.salaryRepo.findById(salaryId)
        if (!salary) {
            throw new Error('Salary record tidak ditemukan')
        }

        if (salary.status !== 'CALCULATED' && salary.status !== 'REVISED') {
            throw new Error(`Tidak dapat submit untuk audit. Status saat ini: ${salary.status}`)
        }

        // Status remains CALCULATED, just ready for audit
        // No status change needed here, auditor will mark as AUDITED
    }

    /**
     * Mark salary as audited
     */
    async audit(salaryId: string, auditorId: string, notes?: string): Promise<void> {
        const salary = await this.salaryRepo.findById(salaryId)
        if (!salary) {
            throw new Error('Salary record tidak ditemukan')
        }

        if (salary.status !== 'CALCULATED' && salary.status !== 'REVISED') {
            throw new Error(`Tidak dapat audit. Status saat ini: ${salary.status}`)
        }

        await this.salaryRepo.updateStatus(salaryId, 'AUDITED', auditorId, notes)
    }

    /**
     * Request revision (audit finds issues)
     */
    async requestRevision(salaryId: string, auditorId: string, reason: string): Promise<void> {
        const salary = await this.salaryRepo.findById(salaryId)
        if (!salary) {
            throw new Error('Salary record tidak ditemukan')
        }

        if (salary.status !== 'CALCULATED' && salary.status !== 'AUDITED') {
            throw new Error(`Tidak dapat request revision. Status saat ini: ${salary.status}`)
        }

        await this.salaryRepo.updateStatus(salaryId, 'REVISED', auditorId)
        
        // Add revision record
        await this.salaryRepo.addRevision(
            salaryId,
            'status',
            salary.status,
            'REVISED',
            reason,
            auditorId
        )
    }

    /**
     * Add manual adjustment (bonus, debt, etc) during revision
     */
    async addManualAdjustment(
        salaryId: string,
        name: string,
        type: 'EARNING' | 'DEDUCTION',
        amount: number,
        notes: string,
        addedById: string
    ): Promise<void> {
        const salary = await this.salaryRepo.findById(salaryId)
        if (!salary) {
            throw new Error('Salary record tidak ditemukan')
        }

        if (salary.status !== 'REVISED') {
            throw new Error(`Tidak dapat menambah komponen manual. Status harus REVISED (klik "Minta Revisi" terlebih dahulu). Saat ini: ${salary.status}`)
        }

        // Add the new detail
        await this.salaryRepo.addDetail(salaryId, {
            name,
            type,
            amount: Number(amount),
            notes: `${notes} (Manual Adjustment)`
        })

        // Add revision record
        await this.salaryRepo.addRevision(
            salaryId,
            `add:${type.toLowerCase()}`,
            null,
            `${name}: ${amount}`,
            notes,
            addedById
        )

        // Recalculate totals
        // Fetch fresh details including the new one
        const updatedSalary = await this.salaryRepo.findById(salaryId)
        if (!updatedSalary) return

        let totalEarnings = 0
        let totalDeductions = 0

        for (const d of updatedSalary.details) {
            if (d.type === 'EARNING') {
                totalEarnings += Number(d.amount)
            } else {
                totalDeductions += Number(d.amount)
            }
        }

        const netSalary = totalEarnings - totalDeductions

        // Update salary totals and ensure status is REVISED
        await this.salaryRepo.update(salaryId, {
            totalEarnings,
            totalDeductions,
            netSalary,
            status: 'REVISED'
        })
    }

    /**
     * Revise a salary detail
     */
    async reviseDetail(
        salaryId: string,
        detailName: string,
        newAmount: number,
        reason: string,
        revisedById: string
    ): Promise<void> {
        const salary = await this.salaryRepo.findById(salaryId)
        if (!salary) {
            throw new Error('Salary record tidak ditemukan')
        }

        // Find the detail to revise
        const detail = salary.details.find(d => d.name === detailName)
        if (!detail) {
            throw new Error(`Detail "${detailName}" tidak ditemukan`)
        }

        const oldAmount = detail.amount

        // Update detail (need to implement in repository or do inline)
        // For now, add revision record
        await this.salaryRepo.addRevision(
            salaryId,
            `detail:${detailName}`,
            String(oldAmount),
            String(newAmount),
            reason,
            revisedById
        )

        // Recalculate totals
        let totalEarnings = 0
        let totalDeductions = 0

        for (const d of salary.details) {
            const amount = d.name === detailName ? newAmount : d.amount
            if (d.type === 'EARNING') {
                totalEarnings += amount
            } else {
                totalDeductions += amount
            }
        }

        const netSalary = totalEarnings - totalDeductions

        await this.salaryRepo.update(salaryId, {
            totalEarnings,
            totalDeductions,
            netSalary,
            status: 'REVISED'
        })
    }

    /**
     * Approve salary (final approval after audit)
     */
    async approve(salaryId: string, approverId: string): Promise<void> {
        const salary = await this.salaryRepo.findById(salaryId)
        if (!salary) {
            throw new Error('Salary record tidak ditemukan')
        }

        if (salary.status !== 'AUDITED') {
            throw new Error(`Tidak dapat approve. Status saat ini: ${salary.status}. Harus AUDITED.`)
        }

        await this.salaryRepo.updateStatus(salaryId, 'APPROVED', approverId)
    }

    /**
     * Mark salary as paid
     */
    async markAsPaid(salaryId: string): Promise<void> {
        const salary = await this.salaryRepo.findById(salaryId)
        if (!salary) {
            throw new Error('Salary record tidak ditemukan')
        }

        if (salary.status !== 'APPROVED') {
            throw new Error(`Tidak dapat mark as paid. Status saat ini: ${salary.status}. Harus APPROVED.`)
        }

        await this.salaryRepo.updateStatus(salaryId, 'PAID')
    }

    /**
     * Bulk approve all audited salaries for a period
     */
    async bulkApprove(month: number, year: number, approverId: string): Promise<number> {
        const { salaries } = await this.salaryRepo.findAll({
            month,
            year,
            status: 'AUDITED'
        })

        let count = 0
        for (const salary of salaries) {
            await this.salaryRepo.updateStatus(salary.id, 'APPROVED', approverId)
            count++
        }

        return count
    }

    /**
     * Bulk mark as paid for a period
     */
    async bulkMarkAsPaid(month: number, year: number): Promise<number> {
        const { salaries } = await this.salaryRepo.findAll({
            month,
            year,
            status: 'APPROVED'
        })

        let count = 0
        for (const salary of salaries) {
            await this.salaryRepo.updateStatus(salary.id, 'PAID')
            count++
        }

        return count
    }
}
