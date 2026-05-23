"use client";

import { SupplierForm } from "../SupplierForm";

interface Props {
  supplierId: string;
}

export function SupplierEditClient({ supplierId }: Props) {
  return <SupplierForm supplierId={supplierId} />;
}
