import { useState, useMemo } from "react";
import type {
  CustomMilestone,
  GrowthSettings,
  LinearGrowthSettings,
  PercentageGrowthSettings,
  RABProject,
} from "../../rabTypes";

type GrowthType = NonNullable<RABProject["growthType"]>;

export function useRABGrowthModel() {
  const [growthType, setGrowthType] = useState<GrowthType>("LINEAR");
  const [linearSettings, setLinearSettings] = useState<LinearGrowthSettings>({
    subscribersPerMonth: 10,
  });
  const [percentageSettings, setPercentageSettings] =
    useState<PercentageGrowthSettings>({
      initialPercent: 10,
      monthlyGrowthPercent: 15,
    });
  const [customMilestones, setCustomMilestones] = useState<CustomMilestone[]>([
    { month: 3, percent: 30 },
    { month: 6, percent: 60 },
    { month: 12, percent: 100 },
  ]);

  // Get current growth settings based on type
  const currentGrowthSettings = useMemo((): GrowthSettings => {
    switch (growthType) {
      case "LINEAR":
        return linearSettings;
      case "PERCENTAGE":
        return percentageSettings;
      case "CUSTOM":
        return { milestones: customMilestones };
    }
  }, [growthType, linearSettings, percentageSettings, customMilestones]);

  return {
    growthType,
    setGrowthType,
    linearSettings,
    setLinearSettings,
    percentageSettings,
    setPercentageSettings,
    customMilestones,
    setCustomMilestones,
    currentGrowthSettings,
  };
}
