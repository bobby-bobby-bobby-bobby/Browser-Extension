import { OptiShieldOverlay } from '../renderer/overlay';
import { settingsStore } from '../storage/settings-store';
import { isSiteDisabled } from '../utils/site';
import type { PerturbationSettings } from '../types/settings';

let overlay: OptiShieldOverlay | undefined;
let observer: MutationObserver | undefined;

async function apply(settings: PerturbationSettings): Promise<void> {
  const active = settings.enabled && !isSiteDisabled(settings.disabledSites);
  if (!active) {
    overlay?.dispose();
    overlay = undefined;
    return;
  }
  if (!overlay) {
    overlay = new OptiShieldOverlay(settings, (stats) => chrome.runtime.sendMessage({ type: 'OPTISHIELD_STATS', stats }).catch(() => undefined));
    overlay.start();
  } else {
    overlay.update(settings);
  }
}

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
