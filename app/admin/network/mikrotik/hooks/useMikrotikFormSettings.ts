import { useEffect, useState } from "react";

import {
  fetchMikrotikFormSettings,
  type PppConnectionMode,
  type RadiusDefaults,
} from "@/app/admin/network/mikrotik/mikrotikFormShared";

const INITIAL_RADIUS_DEFAULTS: RadiusDefaults = {
  authPort: 1812,
  accountingPort: 1813,
};

export function useMikrotikFormSettings() {
  const [pppConnectionMode, setPppConnectionMode] =
    useState<PppConnectionMode>("RADIUS");
  const [radiusDefaults, setRadiusDefaults] = useState<RadiusDefaults>(
    INITIAL_RADIUS_DEFAULTS,
  );

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await fetchMikrotikFormSettings();
      setPppConnectionMode(settings.pppConnectionMode);
      setRadiusDefaults(settings.radiusDefaults);
    };

    void loadSettings();
  }, []);

  return {
    pppConnectionMode,
    radiusDefaults,
  };
}
