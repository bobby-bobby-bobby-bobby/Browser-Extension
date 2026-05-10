import { useEffect, useState } from 'react';
import { settingsStore } from '../../storage/settings-store';
import { DEFAULT_SETTINGS } from '../../storage/defaults';
import type { PerturbationSettings } from '../../types/settings';

export function useSettings() {
  const [settings, setSettingsState] = useState<PerturbationSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    settingsStore.get().then((value) => {
      setSettingsState(value);
      setReady(true);
    });
    return settingsStore.subscribe(setSettingsState);
  }, []);

  const setSettings = async (patch: Partial<PerturbationSettings>) => {
    const next = await settingsStore.set(patch);
    setSettingsState(next);
  };

  return { settings, setSettings, ready };
}
