import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import COAManager from './COAManager';
import type { Metadata } from 'next';
import type { ChartOfAccount } from '@/types/finance';

export const metadata: Metadata = {
  title: 'Chart of Accounts (COA) | NetManager',
  description: 'Manage Chart of Accounts for financial tracking',
};

export const dynamic = 'force-dynamic';

async function getCOAList(): Promise<ChartOfAccount[]> {
  const accounts = await prisma.chartOfAccount.findMany({
    orderBy: {
      code: 'asc',
    },
  });

  // Cast to ChartOfAccount type
  return accounts.map(account => ({
    ...account,
    type: account.type as ChartOfAccount['type'],
    normalBalance: account.normalBalance as ChartOfAccount['normalBalance'],
  })) as ChartOfAccount[];
}

export default async function COAPage() {
  const coaList = await getCOAList();

  return (
    <div className="p-4 sm:p-6">
      <Suspense fallback={<div className="animate-pulse bg-gray-100 dark:bg-gray-800 h-96 rounded-lg" />}>
        <COAManager initialData={coaList} />
      </Suspense>
    </div>
  );
}
