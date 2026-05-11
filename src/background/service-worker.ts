import { DEFAULT_STATS } from '../storage/defaults';
import type { OptiShieldMessage, PerformanceStats } from '../types/settings';

let latestStats: PerformanceStats = DEFAULT_STATS;

chrome.runtime.onInstalled.addListener(() => {
  // Keep first-run behavior quiet: the popup and options page are available from chrome://extensions.
});

async function sendToActiveTab(message: OptiShieldMessage): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return;
  await chrome.tabs.sendMessage(tab.id, message).catch(() => undefined);
}

chrome.runtime.onMessage.addListener((message: OptiShieldMessage, _sender, sendResponse) => {
  if (message.type === 'OPTISHIELD_STATS') {
    latestStats = message.stats;
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'OPTISHIELD_GET_STATS') {
    sendResponse({ ok: true, stats: latestStats });
    return false;
  }

  if (message.type === 'OPTISHIELD_SETTINGS_UPDATED') {
    void sendToActiveTab(message).then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});
