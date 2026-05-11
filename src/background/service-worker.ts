import { DEFAULT_STATS } from '../storage/defaults';
import type { OptiShieldMessage, PerformanceStats } from '../types/settings';

let latestStats: PerformanceStats = DEFAULT_STATS;

chrome.runtime.onInstalled.addListener(() => {
  // Keep first-run behavior quiet: the popup and options page are available from chrome://extensions.
});

async function sendToActiveTab(message: OptiShieldMessage): Promise<{ ok: boolean; error?: string }> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return { ok: false, error: 'No active tab found' };
    await chrome.tabs.sendMessage(tab.id, message).catch(() => undefined);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
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
    void sendToActiveTab(message).then(sendResponse);
    return true;
  }

  return false;
});
