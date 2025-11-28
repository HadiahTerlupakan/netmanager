import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedBudgetCategories() {
    console.log('Seeding budget categories...');

    const budgetCategories = [
        // OPEX Categories
        {
            code: 'OPEX_OPERASIONAL',
            name: 'Operational Expenses',
            description: 'General operational costs',
            type: 'OPEX',
            parentId: null,
            isActive: true,
        },
        {
            code: 'OPEX_MARKETING',
            name: 'Marketing & Advertising',
            description: 'Marketing campaigns and advertising',
            type: 'OPEX',
            parentId: null,
            isActive: true,
        },
        {
            code: 'OPEX_GAJI',
            name: 'Salaries & Wages',
            description: 'Employee salaries and benefits',
            type: 'OPEX',
            parentId: null,
            isActive: true,
        },
        {
            code: 'OPEX_ADMINISTRATIF',
            name: 'Administrative Expenses',
            description: 'Office and administrative costs',
            type: 'OPEX',
            parentId: null,
            isActive: true,
        },
        {
            code: 'OPEX_VENDOR',
            name: 'Vendor & Supplier Costs',
            description: 'Third-party vendor payments',
            type: 'OPEX',
            parentId: null,
            isActive: true,
        },
        {
            code: 'OPEX_MAINTENANCE',
            name: 'Maintenance & Repairs',
            description: 'Equipment and facility maintenance',
            type: 'OPEX',
            parentId: null,
            isActive: true,
        },
        // ISP-Specific OPEX
        {
            code: 'OPEX_BANDWIDTH_UPSTREAM',
            name: 'Bandwidth & Transit Costs',
            description: 'Upstream bandwidth, peering, and transit costs',
            type: 'OPEX',
            parentId: null,
            isActive: true,
        },
        {
            code: 'OPEX_NOC_OPERATIONS',
            name: 'NOC Operations',
            description: 'Network Operations Center staff and monitoring',
            type: 'OPEX',
            parentId: null,
            isActive: true,
        },
        {
            code: 'OPEX_FIELD_TECHNICIAN',
            name: 'Field Technician Operations',
            description: 'Installation, maintenance, and field support',
            type: 'OPEX',
            parentId: null,
            isActive: true,
        },
        {
            code: 'OPEX_CUSTOMER_ACQUISITION',
            name: 'Customer Acquisition Cost',
            description: 'Sales commissions and customer acquisition',
            type: 'OPEX',
            parentId: null,
            isActive: true,
        },
        {
            code: 'OPEX_USO_CONTRIBUTION',
            name: 'BHP & USO (1.25%)',
            description: 'Biaya Hak Penyelenggaraan & Kontribusi Kewajiban Pelayanan Universal',
            type: 'OPEX',
            parentId: null,
            isActive: true,
        },

        // CAPEX Categories
        {
            code: 'CAPEX_INFRASTRUKTUR_JARINGAN',
            name: 'Network Infrastructure',
            description: 'Core network infrastructure investment',
            type: 'CAPEX',
            parentId: null,
            isActive: true,
        },
        {
            code: 'CAPEX_PERALATAN',
            name: 'Equipment & Hardware',
            description: 'General equipment purchases',
            type: 'CAPEX',
            parentId: null,
            isActive: true,
        },
        {
            code: 'CAPEX_TEKNOLOGI',
            name: 'Technology & Software',
            description: 'Software and technology investments',
            type: 'CAPEX',
            parentId: null,
            isActive: true,
        },
        {
            code: 'CAPEX_BANGUNAN',
            name: 'Building & Facilities',
            description: 'Building construction and renovation',
            type: 'CAPEX',
            parentId: null,
            isActive: true,
        },
        // ISP-Specific CAPEX
        {
            code: 'CAPEX_FIBER_DEPLOYMENT',
            name: 'Fiber Optic Deployment',
            description: 'Fiber cable, trenching, and installation',
            type: 'CAPEX',
            parentId: null,
            isActive: true,
        },
        {
            code: 'CAPEX_CORE_EQUIPMENT',
            name: 'Core Network Equipment',
            description: 'OLT, BNG, routers, switches, and core devices',
            type: 'CAPEX',
            parentId: null,
            isActive: true,
        },
        {
            code: 'CAPEX_PASSIVE_INFRASTRUCTURE',
            name: 'Passive Infrastructure',
            description: 'ODP, OTB, patch panels, and passive components',
            type: 'CAPEX',
            parentId: null,
            isActive: true,
        },
    ]

    for (const category of budgetCategories) {
        await prisma.budgetCategory.upsert({
            where: { code: category.code },
            update: category,
            create: category,
        });
    }

    const opexCount = budgetCategories.filter(c => c.type === 'OPEX').length;
    const capexCount = budgetCategories.filter(c => c.type === 'CAPEX').length;
    console.log(`✅ Seeded ${budgetCategories.length} budget categories (${opexCount} OPEX + ${capexCount} CAPEX, includes USO)`);
}

async function seedTaxDeadlines() {
    console.log('Seeding tax filing deadlines for current year...');

    const currentYear = new Date().getFullYear();
    const taxTypes = ['PPN', 'PPH_21', 'PPH_23', 'PPH_4_2'];

    let count = 0;
    for (let month = 1; month <= 12; month++) {
        for (const taxType of taxTypes) {
            // Deadline is typically end of the following month (e.g., Jan deadline is end of Feb)
            const deadlineMonth = month === 12 ? 1 : month + 1;
            const deadlineYear = month === 12 ? currentYear + 1 : currentYear;
            const deadline = new Date(deadlineYear, deadlineMonth - 1, taxType === 'PPN' ? 20 : 15); // PPN: 20th, PPh: 15th

            await prisma.taxFilingDeadline.upsert({
                where: {
                    taxType_period_year: {
                        taxType,
                        period: month,
                        year: currentYear,
                    },
                },
                update: {
                    deadline,
                },
                create: {
                    taxType,
                    period: month,
                    year: currentYear,
                    deadline,
                    status: deadline < new Date() ? 'LATE' : 'PENDING',
                },
            });
            count++;
        }
    }

    console.log(`✅ Seeded ${count} tax filing deadlines for ${currentYear}`);
}

async function main() {
    try {
        await seedBudgetCategories();
        await seedTaxDeadlines();
        console.log('\n✅ All seed data created successfully!');
    } catch (error) {
        console.error('❌ Error seeding data:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
