import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'

async function debugIncome() {
    console.log("Debugging Income Data...");
    const service = getMixRadiusService();

    // Coba ambil data Januari 2026
    const params = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        length: 10,
        start: 0,
        search: '',
        sortBy: 'renewed_on',
        sortDir: 'asc' as const
    };

    try {
        console.log("Fetching Summary...");
        const summary = await service.fetchIncomeSummary(params);
        console.log("Summary Result:", JSON.stringify(summary, null, 2));

        console.log("Fetching Records...");
        const records = await service.fetchIncomeByPeriod(params);
        console.log("Records Count:", records.recordsTotal);
        if (records.data.length > 0) {
            console.log("First Record Sample:", JSON.stringify(records.data[0], null, 2));
        }
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

debugIncome();