/**
 * Script untuk menambahkan permission Salary ke database
 * 
 * Jalankan dengan: npx ts-node scripts/seed-salary-permissions.ts
 */

import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL not found')

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const SALARY_PERMISSIONS = [
    // Basic CRUD permissions
    { resource: 'salary', action: 'read', description: 'Melihat data gaji' },
    { resource: 'salary', action: 'create', description: 'Membuat data gaji' },
    { resource: 'salary', action: 'update', description: 'Mengubah data gaji' },
    { resource: 'salary', action: 'delete', description: 'Menghapus data gaji' },
    
    // Salary config permissions
    { resource: 'salary_config', action: 'read', description: 'Melihat konfigurasi gaji' },
    { resource: 'salary_config', action: 'update', description: 'Mengubah konfigurasi gaji' },
    
    // Salary components permissions
    { resource: 'salary_components', action: 'read', description: 'Melihat komponen gaji' },
    { resource: 'salary_components', action: 'create', description: 'Membuat komponen gaji' },
    { resource: 'salary_components', action: 'update', description: 'Mengubah komponen gaji' },
    { resource: 'salary_components', action: 'delete', description: 'Menghapus komponen gaji' },
    
    // Granular permissions for sensitive operations
    { resource: 'salary', action: 'calculate', description: 'Menghitung gaji karyawan' },
    { resource: 'salary', action: 'audit', description: 'Mengaudit data gaji' },
    { resource: 'salary', action: 'approve', description: 'Menyetujui gaji' },
    { resource: 'salary', action: 'mark_paid', description: 'Menandai gaji sudah dibayar' },
    { resource: 'salary', action: 'view_all', description: 'Melihat semua gaji (bypass privacy)' },
]

async function main() {
    console.log('🚀 Seeding Salary permissions...')
    
    let created = 0
    let skipped = 0
    
    for (const perm of SALARY_PERMISSIONS) {
        const exists = await prisma.permission.findFirst({
            where: {
                resource: perm.resource,
                action: perm.action
            }
        })
        
        if (exists) {
            console.log(`  ⏭️  Skip: ${perm.resource}:${perm.action} (sudah ada)`)
            skipped++
            continue
        }
        
        await prisma.permission.create({
            data: {
                id: crypto.randomUUID(),
                name: `${perm.resource}:${perm.action}`,
                resource: perm.resource,
                action: perm.action,
                description: perm.description,
                updatedAt: new Date()
            }
        })
        
        console.log(`  ✅ Created: ${perm.resource}:${perm.action}`)
        created++
    }
    
    console.log(`\n📊 Summary:`)
    console.log(`  - Created: ${created}`)
    console.log(`  - Skipped: ${skipped}`)
    console.log(`  - Total: ${SALARY_PERMISSIONS.length}`)
    
    // Assign to relevant roles
    console.log(`\n📌 Assigning permissions to roles...`)
    
    const targetRoles = await prisma.role.findMany({
        where: {
            name: {
                in: ['Super Admin', 'SUPER_ADMIN', 'HRD', 'Finance', 'FINANCE', 'HR', 'Admin', 'ADMIN']
            }
        }
    })
    
    console.log(`Found ${targetRoles.length} target roles: ${targetRoles.map(r => r.name).join(', ')}`)
    
    const allSalaryPerms = await prisma.permission.findMany({
        where: {
            resource: { in: ['salary', 'salary_config', 'salary_components'] }
        }
    })
    
    for (const role of targetRoles) {
        await prisma.role.update({
            where: { id: role.id },
            data: {
                permission: {
                    connect: allSalaryPerms.map(p => ({ id: p.id }))
                }
            }
        })
        console.log(`  ✅ Assigned ${allSalaryPerms.length} permissions to role: ${role.name}`)
    }
    
    console.log('\n🎉 Done!')
}

main()
    .catch((e) => {
        console.error('❌ Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
