// src/storage/defaults.ts
var DEFAULT_SETTINGS = {
  enabled: true,
  mode: "canvas2d",
  intensity: 50,
  jitter: 40,
  edgeInstability: 38,
  ocrDisruption: 34,
  frequencyDisruption: 32,
  distortionStyle: "organic",
  warpAmplitude: 34,
  warpSpeed: 26,
  warpDensity: 30,
  warpCurvature: 28,
  adaptiveTemporalPhaseShifting: true,
  subpixelChromaDrift: true,
  edgeReconstructionPoisoning: true,
  compressionInterferencePatterns: true,
  debugPanel: false,
  reducedMotion: false,
  lowEyeStrain: true,
  dyslexiaFriendly: false,
  highContrastCompatible: true,
  disabledSites: []
};
var DEFAULT_STATS = {
  fps: 60,
  frameMs: 16.7,
  droppedFrames: 0,
  recommendedMode: "canvas2d",
  renderer: "canvas2d",
  qualityScale: 1,
  perturbationStrength: DEFAULT_SETTINGS.intensity,
  ocrResistance: 54
};

// src/background/service-worker.ts
var latestStats = DEFAULT_STATS;
chrome.runtime.onInstalled.addListener(() => {
});
async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === void 0) return;
  await chrome.tabs.sendMessage(tab.id, message).catch(() => void 0);
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OPTISHIELD_STATS") {
    latestStats = message.stats;
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === "OPTISHIELD_GET_STATS") {
    sendResponse({ ok: true, stats: latestStats });
    return false;
  }
  if (message.type === "OPTISHIELD_SETTINGS_UPDATED") {
    void sendToActiveTab(message).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
