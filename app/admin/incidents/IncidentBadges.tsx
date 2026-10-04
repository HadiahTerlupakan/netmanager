import {
  HiOutlineExclamationCircle,
  HiOutlineExclamationTriangle,
  HiOutlineFire,
} from "react-icons/hi2";
import type { IncidentSeverity } from "./incident-format";

const SEVERITY_ICON = {
  CRITICAL: HiOutlineFire,
  MAJOR: HiOutlineExclamationCircle,
  MINOR: HiOutlineExclamationTriangle,
} as const;

/** Ikon tingkat gangguan; ukuran & warna diatur pemanggil. */
export function SeverityIcon({
  severity,
  className,
}: {
  severity: IncidentSeverity;
  className: string;
}) {
  const Icon = SEVERITY_ICON[severity];
  return <Icon className={className} />;
}
