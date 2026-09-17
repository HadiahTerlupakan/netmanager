import { useState } from "react";
import type { RabTargetBasis } from "@/modules/finance/client";

export function useRABTargetRevenue() {
  const [targetBasis, setTargetBasis] = useState<RabTargetBasis>("HOMECONNECT");
  const [targetHomepass, setTargetHomepass] = useState(0);
  const [targetTakeUpRatePercent, setTargetTakeUpRatePercent] = useState(40);
  const [targetSubscribers, setTargetSubscribers] = useState(0);
  const [arpu, setArpu] = useState(0);
  const [paymentType, setPaymentType] = useState<"PREPAID" | "POSTPAID">(
    "PREPAID",
  );

  return {
    targetBasis,
    setTargetBasis,
    targetHomepass,
    setTargetHomepass,
    targetTakeUpRatePercent,
    setTargetTakeUpRatePercent,
    targetSubscribers,
    setTargetSubscribers,
    arpu,
    setArpu,
    paymentType,
    setPaymentType,
  };
}
