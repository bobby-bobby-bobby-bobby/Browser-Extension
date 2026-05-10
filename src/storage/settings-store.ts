import { DEFAULT_SETTINGS } from './defaults';
import type { PerturbationSettings } from '../types/settings';

const KEY = 'optishield.settings';

type Listener = (settings: PerturbationSettings) => void;

export class SettingsStore {
  private listeners = new Set<Listener>();

  async get(): Promise<PerturbationSettings> {
    const result = await chrome.storage.local.get(KEY);
    return { ...DEFAULT_SETTINGS, ...(result[KEY] ?? {}) };
  }

  async set(next: Partial<PerturbationSettings>): Promise<PerturbationSettings> {
    const merged = { ...(await this.get()), ...next };
    await chrome.storage.local.set({ [KEY]: merged });
    return merged;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    const storageListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && KEY in changes) {
        listener({ ...DEFAULT_SETTINGS, ...(changes[KEY].newValue ?? {}) });
      }
    };
    chrome.storage.onChanged.addListener(storageListener);
    return () => {
      this.listeners.delete(listener);
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }

  private emit(settings: PerturbationSettings): void {
    this.listeners.forEach((listener) => listener(settings));
  }
}

export const settingsStore = new SettingsStore();
