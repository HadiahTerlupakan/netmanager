import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { RECURRENCE_LABEL } from "../legal-format";
import { LEGAL_RECURRENCES, type LegalRecurrence } from "../legal-types";
import { EMPTY_OBLIGATION, type ObligationDraft } from "./legal-form-state";
import { CollapsibleSection, INPUT_CLASS } from "./form-fields";

/** Seksi "Kewajiban berkala": baris deskripsi, jatuh tempo, dan pengulangan. */
export default function ObligationRows({
  obligations,
  onChange,
}: {
  obligations: ObligationDraft[];
  onChange: (next: ObligationDraft[]) => void;
}) {
  const replaceRow = (index: number, patch: Partial<ObligationDraft>) => {
    onChange(
      obligations.map((row, position) =>
        position === index ? { ...row, ...patch } : row,
      ),
    );
  };

  return (
    <CollapsibleSection
      title={`Kewajiban berkala (${obligations.length})`}
      isInitiallyOpen={obligations.length > 0}
    >
      {obligations.map((row, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_9rem_8rem_auto]">
          <input
            type="text"
            value={row.description}
            onChange={(event) =>
              replaceRow(index, { description: event.target.value })
            }
            className={INPUT_CLASS}
            placeholder="Bayar retribusi izin"
            aria-label="Deskripsi kewajiban"
          />
          <input
            type="date"
            value={row.dueDate}
            onChange={(event) => replaceRow(index, { dueDate: event.target.value })}
            className={INPUT_CLASS}
            aria-label="Jatuh tempo"
          />
          <select
            value={row.recurrence}
            onChange={(event) =>
              replaceRow(index, {
                recurrence: event.target.value as LegalRecurrence,
              })
            }
            className={INPUT_CLASS}
            aria-label="Berulang"
          >
            {LEGAL_RECURRENCES.map((recurrence) => (
              <option key={recurrence} value={recurrence}>
                {RECURRENCE_LABEL[recurrence]}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange(obligations.filter((_, position) => position !== index))
            }
            aria-label="Hapus kewajiban"
          >
            <HiOutlineTrash className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange([...obligations, { ...EMPTY_OBLIGATION }])}
        className="inline-flex items-center gap-1.5"
      >
        <HiOutlinePlus className="h-4 w-4" />
        Tambah kewajiban
      </Button>
    </CollapsibleSection>
  );
}
