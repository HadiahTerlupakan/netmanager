import { prisma } from './lib/prisma.js';
import { Prisma, WorkOrderStatus } from '@prisma/client';

async function main() {
  try {
    console.log('Testing Unassigned Only filter logic...');
    
    // Get a valid tenant first
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        console.error('No tenant found in database');
        return;
    }
    
    console.log('Using tenant:', tenant.id);
    
    const unassignedOnly = true;
    const where: Prisma.WorkOrdersWhereInput = {
        tenantId: tenant.id
    };
    
    if (unassignedOnly) {
      where.assignedToId = null;
      where.assignedMitraId = null;
      
      // Try with a simpler filter first to see if it's the NOT IN causing issue
      where.status = { notIn: ['CANCELLED', 'CLOSED', 'COMPLETED', 'VERIFIED'] as WorkOrderStatus[] };
    }
    
    console.log('Query where:', JSON.stringify(where, null, 2));
    
    const count = await prisma.workOrders.count({ where });
    console.log('Count success:', count);
    
    const samples = await prisma.workOrders.findMany({
      where,
      take: 5,
      select: {
        id: true,
        workOrderNumber: true,
        status: true,
        assignedToId: true
      }
    });
    
    console.log('Samples:', JSON.stringify(samples, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
