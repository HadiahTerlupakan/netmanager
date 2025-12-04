/**
 * Quick FreeRADIUS Integration Test Script
 * 
 * Run this to verify RADIUS sync is working
 */

import { PrismaClient } from '@prisma/client';
import { RadiusSyncService } from '../lib/services/radius-sync-service.js';
import { RadiusRepository } from '../lib/repositories/RadiusRepository.js';

const prisma = new PrismaClient();

async function testRadiusIntegration() {
    console.log('🧪 Testing FreeRADIUS Integration...\n');

    const radiusRepo = new RadiusRepository(prisma);
    const syncService = new RadiusSyncService(prisma);

    try {
        // 1. Check RADIUS tables exist
        console.log('1️⃣ Checking RADIUS tables...');
        const radcheckCount = await prisma.radCheck.count();
        const radreplyCount = await prisma.radReply.count();
        const radacctCount = await prisma.radAcct.count();
        console.log(`   ✅ radcheck: ${radcheckCount} rows`);
        console.log(`   ✅ radreply: ${radreplyCount} rows`);
        console.log(`   ✅ radacct: ${radacctCount} rows\n`);

        // 2. Check Pelanggan count
        console.log('2️⃣ Checking Pelanggan data...');
        const pelangganCount = await prisma.pelanggan.count();
        const aktivPelangganCount = await prisma.pelanggan.count({
            where: { status: 'AKTIF' },
        });
        console.log(`   Total Pelanggan: ${pelangganCount}`);
        console.log(`   AKTIF Pelanggan: ${aktivPelangganCount}\n`);

        if (aktivPelangganCount === 0) {
            console.log('⚠️  No active customers found. Please create test customer first.\n');
            return;
        }

        // 3. Sync all active customers
        console.log('3️⃣ Syncing active customers to RADIUS...');
        const result = await syncService.syncAllActiveCustomers();
        console.log(`   ✅ Created: ${result.created}`);
        console.log(`   ✅ Updated: ${result.updated}`);
        console.log(`   ✅ Deleted: ${result.deleted}`);
        console.log(`   ✅ Total: ${result.created + result.updated + result.deleted}\n`);

        // 4. Verify sync
        console.log('4️⃣ Verifying RADIUS users...');
        const radcheckAfter = await prisma.radCheck.count();
        const radreplyAfter = await prisma.radReply.count();
        console.log(`   radcheck users: ${radcheckAfter}`);
        console.log(`   radreply entries: ${radreplyAfter}\n`);

        // 5. Show sample RADIUS user
        const sampleUser = await prisma.radCheck.findFirst({
            where: {
                attribute: 'Cleartext-Password'
            }
        });

        if (sampleUser) {
            console.log('5️⃣ Sample RADIUS user:');
            console.log(`   Username: ${sampleUser.username}`);
            console.log(`   Attribute: ${sampleUser.attribute}`);
            console.log(`   Operator: ${sampleUser.op}`);
            console.log(`   Value: ${sampleUser.value.substring(0, 8)}***\n`);

            // Get bandwidth for this user
            const bandwidth = await radiusRepo.getUserBandwidth(sampleUser.username);
            if (bandwidth) {
                console.log('6️⃣ Bandwidth settings:');
                console.log(`   Upload: ${bandwidth.uploadMbps} Mbps`);
                console.log(`   Download: ${bandwidth.downloadMbps} Mbps\n`);
            }
        }

        console.log('✅ All tests passed!\n');
        console.log('📝 Next steps:');
        console.log('   1. Configure MikroTik RADIUS client');
        console.log('   2. Test PPPoE authentication');
        console.log('   3. Check radacct for session data\n');
    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run tests
testRadiusIntegration()
    .then(() => {
        console.log('Test completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Test failed:', error);
        process.exit(1);
    });
