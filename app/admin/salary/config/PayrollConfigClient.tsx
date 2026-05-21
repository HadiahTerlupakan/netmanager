"use client";

import { useApi } from "@/lib/hooks/useApi";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/LoadingSkeleton";

// ============================================================================
// Types
// ============================================================================

interface BpjsProgramRate {
  employeeRate: number;
  employerRate: number;
  maxBase: number | null;
  maxAge?: number;
}

interface BpjsEmployerOnlyRate {
  employerRate: number;
  riskCategory?: number;
}

interface BpjsRateConfig {
  kesehatan: BpjsProgramRate;
  jht: BpjsProgramRate;
  jp: BpjsProgramRate & { maxAge: number };
  jkk: BpjsEmployerOnlyRate;
  jkm: BpjsEmployerOnlyRate;
}

interface TaxConfig {
  defaultMethod: string;
  terYear: number;
  npwpSurcharge: number;
  biayaJabatanRate: number;
  biayaJabatanMax: number;
}

interface OvertimeConfig {
  maxHoursPerDay: number;
  maxHoursPerWeek: number;
  maxHoursPerMonth: number | null;
  rateBase: string;
  capEnforcement: string;
}

interface PayrollConfig {
  tenantId: string;
  bpjs: BpjsRateConfig;
  tax: TaxConfig;
  overtime: OvertimeConfig;
}

// ============================================================================
// Component
// ============================================================================

/** Displays tenant payroll configuration (read-only view) */
export function PayrollConfigClient() {
  const { data, isLoading } = useApi<PayrollConfig>("/api/admin/salary/config");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground">Gagal memuat konfigurasi.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Konfigurasi Payroll</h1>

      {/* BPJS Section */}
      <Card>
        <CardHeader>
          <CardTitle>BPJS</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <BpjsProgramCard title="Kesehatan" rate={data.bpjs.kesehatan} />
            <BpjsProgramCard title="JHT" rate={data.bpjs.jht} />
            <BpjsProgramCard title="JP" rate={data.bpjs.jp} />
            <BpjsEmployerCard title="JKK" rate={data.bpjs.jkk} />
            <BpjsEmployerCard title="JKM" rate={data.bpjs.jkm} />
          </div>
        </CardContent>
      </Card>

      {/* Tax Section */}
      <Card>
        <CardHeader>
          <CardTitle>Pajak (PPh 21)</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm">
            <ConfigRow label="Metode Default" value={data.tax.defaultMethod} />
            <ConfigRow label="Tahun TER" value={data.tax.terYear} />
            <ConfigRow
              label="Surcharge Non-NPWP"
              value={`${(data.tax.npwpSurcharge * 100).toFixed(0)}%`}
            />
            <ConfigRow
              label="Biaya Jabatan"
              value={`${(data.tax.biayaJabatanRate * 100).toFixed(1)}% (maks ${formatCurrency(data.tax.biayaJabatanMax)}/bln)`}
            />
          </dl>
        </CardContent>
      </Card>

      {/* Overtime Section */}
      <Card>
        <CardHeader>
          <CardTitle>Lembur</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm">
            <ConfigRow
              label="Maks/Hari"
              value={`${data.overtime.maxHoursPerDay} jam`}
            />
            <ConfigRow
              label="Maks/Minggu"
              value={`${data.overtime.maxHoursPerWeek} jam`}
            />
            <ConfigRow
              label="Maks/Bulan"
              value={
                data.overtime.maxHoursPerMonth
                  ? `${data.overtime.maxHoursPerMonth} jam`
                  : "Tidak dibatasi"
              }
            />
            <ConfigRow label="Basis Rate" value={data.overtime.rateBase} />
            <ConfigRow
              label="Cap Enforcement"
              value={data.overtime.capEnforcement}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function BpjsProgramCard({
  title,
  rate,
}: {
  title: string;
  rate: BpjsProgramRate;
}) {
  return (
    <div className="rounded-md border p-3">
      <h4 className="font-medium">{title}</h4>
      <dl className="mt-2 space-y-1 text-sm text-muted-foreground">
        <ConfigRow
          label="Karyawan"
          value={`${(rate.employeeRate * 100).toFixed(2)}%`}
        />
        <ConfigRow
          label="Perusahaan"
          value={`${(rate.employerRate * 100).toFixed(2)}%`}
        />
        <ConfigRow
          label="Batas Upah"
          value={rate.maxBase ? formatCurrency(rate.maxBase) : "Tidak ada"}
        />
        {rate.maxAge && (
          <ConfigRow label="Batas Usia" value={`${rate.maxAge} tahun`} />
        )}
      </dl>
    </div>
  );
}

function BpjsEmployerCard({
  title,
  rate,
}: {
  title: string;
  rate: BpjsEmployerOnlyRate;
}) {
  return (
    <div className="rounded-md border p-3">
      <h4 className="font-medium">{title}</h4>
      <dl className="mt-2 space-y-1 text-sm text-muted-foreground">
        <ConfigRow
          label="Perusahaan"
          value={`${(rate.employerRate * 100).toFixed(3)}%`}
        />
        {rate.riskCategory && (
          <ConfigRow label="Kategori Risiko" value={rate.riskCategory} />
        )}
      </dl>
    </div>
  );
}

function ConfigRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
