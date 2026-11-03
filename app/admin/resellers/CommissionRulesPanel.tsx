"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import {
  MAX_COMMISSION_PERCENT,
  MAX_FIXED_COMMISSION,
} from "@/modules/reseller/client";
import { LoadErrorState } from "./LoadErrorState";
import {
  buildRulePayload,
  describeRulePeriod,
  describeRuleValue,
  resellerApiUrl,
  type CommissionRule,
  type RuleForm,
} from "./commission-ui";
import { getErrorMessage, sendResellerMutation } from "./reseller-requests";

const PACKAGE_LIST_URL = "/api/hargapakets";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white";

const EMPTY_RULE_FORM: RuleForm = {
  type: "PERCENTAGE",
  value: "",
  hargaPaketId: "",
  startsAt: "",
  endsAt: "",
};

type PackageOption = { readonly id: string; readonly name: string };

type CommissionRulesPanelProps = {
  readonly resellerId: string;
  /** Izin reseller:update + transactions:create. */
  readonly canManage: boolean;
};

/**
 * Aturan komisi reseller: persen dari DPP (tanpa PPN) atau nominal tetap per
 * invoice lunas, untuk semua paket atau satu paket. Akrual memakai aturan aktif
 * pada tanggal lunas; aturan per paket didahulukan.
 */
export function CommissionRulesPanel({
  resellerId,
  canManage,
}: CommissionRulesPanelProps) {
  const rulesUrl = resellerApiUrl(resellerId, "commission-rules");
  const rulesQuery = useApi<readonly CommissionRule[]>(rulesUrl);
  const packagesQuery = useApi<readonly PackageOption[]>(
    canManage ? PACKAGE_LIST_URL : null,
  );
  const [form, setForm] = useState<RuleForm>(EMPTY_RULE_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const rules = rulesQuery.data ?? [];
  const packages = packagesQuery.data ?? [];

  const runMutation = async (
    action: () => Promise<void>,
    successMessage: string,
  ) => {
    setIsSaving(true);
    try {
      await action();
      toast.success(successMessage);
      await rulesQuery.mutate();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const createRule = async () => {
    const payload = buildRulePayload(form);
    if (!payload) {
      toast.error("Nilai komisi harus bilangan bulat lebih dari 0");
      return;
    }
    await runMutation(async () => {
      await sendResellerMutation(rulesUrl, "POST", payload);
      setForm(EMPTY_RULE_FORM);
    }, "Aturan komisi ditambahkan");
  };

  const deactivateRule = (rule: CommissionRule) =>
    runMutation(
      () => sendResellerMutation(`${rulesUrl}/${rule.id}`, "DELETE"),
      "Aturan komisi dinonaktifkan",
    );

  return (
    <section
      aria-labelledby="commission-rules-title"
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <h2
        id="commission-rules-title"
        className="font-semibold text-gray-900 dark:text-white"
      >
        Aturan komisi
      </h2>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Komisi dihitung dari DPP (tagihan tanpa PPN) setiap invoice pelanggan
        reseller yang lunas.
      </p>
      {rulesQuery.error ? (
        <LoadErrorState
          title="Gagal memuat aturan komisi"
          error={rulesQuery.error}
          onRetry={() => void rulesQuery.refetch()}
        />
      ) : rules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {rulesQuery.isLoading
            ? "Memuat..."
            : "Belum ada aturan komisi; komisi tidak akan terbit."}
        </p>
      ) : (
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 p-3 text-sm dark:border-gray-700"
            >
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {describeRuleValue(rule)} ·{" "}
                  {rule.hargaPaketName ?? "Semua paket"}
                </div>
                <div className="text-gray-500 dark:text-gray-400">
                  {describeRulePeriod(rule)} ·{" "}
                  {rule.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                </div>
              </div>
              {canManage && rule.status === "ACTIVE" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => void deactivateRule(rule)}
                >
                  Nonaktifkan
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <form
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void createRule();
          }}
        >
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Jenis komisi
            <select
              className={INPUT_CLASS}
              value={form.type}
              onChange={(event) =>
                setForm({
                  ...form,
                  type: event.target.value as RuleForm["type"],
                })
              }
            >
              <option value="PERCENTAGE">Persen dari DPP</option>
              <option value="FIXED">Nominal per invoice</option>
            </select>
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300">
            {form.type === "PERCENTAGE" ? "Persen (1–100)" : "Nominal (Rp)"}
            <input
              className={INPUT_CLASS}
              type="number"
              min={1}
              max={
                form.type === "PERCENTAGE"
                  ? MAX_COMMISSION_PERCENT
                  : MAX_FIXED_COMMISSION
              }
              step={1}
              required
              value={form.value}
              onChange={(event) =>
                setForm({ ...form, value: event.target.value })
              }
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Paket
            <select
              className={INPUT_CLASS}
              value={form.hargaPaketId}
              onChange={(event) =>
                setForm({ ...form, hargaPaketId: event.target.value })
              }
            >
              <option value="">Semua paket</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Mulai
              <input
                className={INPUT_CLASS}
                type="date"
                value={form.startsAt}
                onChange={(event) =>
                  setForm({ ...form, startsAt: event.target.value })
                }
              />
            </label>
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Berakhir
              <input
                className={INPUT_CLASS}
                type="date"
                value={form.endsAt}
                onChange={(event) =>
                  setForm({ ...form, endsAt: event.target.value })
                }
              />
            </label>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={isSaving}>
              Tambah aturan
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
