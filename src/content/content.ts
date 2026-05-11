import { OptiShieldOverlay } from '../renderer/overlay';
import { settingsStore } from '../storage/settings-store';
import { isSiteDisabled } from '../utils/site';
import type { OptiShieldMessage, PerformanceStats, PerturbationSettings } from '../types/settings';

let overlay: OptiShieldOverlay | undefined;
let observer: MutationObserver | undefined;
let currentSettings: PerturbationSettings | undefined;

async function publishStats(stats: PerformanceStats): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'OPTISHIELD_STATS', stats }).catch(() => undefined);
}

async function apply(settings: PerturbationSettings): Promise<void> {
  currentSettings = settings;
  const active = settings.enabled && !isSiteDisabled(settings.disabledSites);
  if (!active) {
    overlay?.dispose();
    overlay = undefined;
    return;
  }
  if (!overlay) {
    overlay = new OptiShieldOverlay(settings, (stats) => void publishStats(stats));
    overlay.start();
  } else {
    overlay.update(settings);
  }
}

chrome.runtime.onMessage.addListener((message: OptiShieldMessage, _sender, sendResponse) => {
  if (message.type === 'OPTISHIELD_SETTINGS_UPDATED') {
    void apply(message.settings).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === 'OPTISHIELD_GET_SETTINGS') {
    sendResponse({ ok: true, settings: currentSettings });
    return false;
  }
  return false;
});

settingsStore.get().then(apply).catch(() => undefined);
settingsStore.subscribe((settings) => void apply(settings));

observer = new MutationObserver(() => {
  if (overlay && !document.getElementById('optishield-overlay')) {
    overlay.dispose();
    overlay = undefined;
    void settingsStore.get().then(apply);
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener('pagehide', () => {
  observer?.disconnect();
  overlay?.dispose();
});
