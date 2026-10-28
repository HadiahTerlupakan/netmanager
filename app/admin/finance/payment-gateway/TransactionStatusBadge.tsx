import { STATUS_STYLE, type GatewayDisplayStatus } from "./transaction-types";

export function TransactionStatusBadge({
  status,
}: {
  status: GatewayDisplayStatus;
}) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${style.className}`}
    >
      {style.label}
    </span>
  );
}
