import { useState } from "react";
import type { LocalItem, LocalDisbursement } from "../../ItemDisbursementModal";
import type { LocalWbs } from "../utils/rabFormPayloadBuilder";

export function useRABItems() {
  const [items, setItems] = useState<LocalItem[]>([]);
  const [wbsGroups, setWbsGroups] = useState<LocalWbs[]>([]);
  const [activeTerminItemId, setActiveTerminItemId] = useState<string | null>(
    null,
  );

  const handleAddItem = (expenseType: "CAPEX" | "OPEX") => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        name: "",
        category: expenseType === "CAPEX" ? "DEVICE" : "OPERATIONAL",
        quantity: 1,
        unitPrice: 0,
        expenseType: expenseType,
        disbursements: [],
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const updateItem = (
    id: string,
    field: string,
    value: string | number | string[] | LocalDisbursement[],
  ) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  return {
    items,
    setItems,
    wbsGroups,
    setWbsGroups,
    activeTerminItemId,
    setActiveTerminItemId,
    handleAddItem,
    handleRemoveItem,
    updateItem,
  };
}
