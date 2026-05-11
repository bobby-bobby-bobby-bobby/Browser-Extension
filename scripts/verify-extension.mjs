import { readFile, stat } from 'node:fs/promises';
const dist = new URL('../dist/', import.meta.url);

async function mustExist(relativePath) {
  await stat(new URL(relativePath, dist));
}

function assertContains(label, text, required) {
  const missing = required.filter((needle) => !text.includes(needle));
  if (missing.length) {
    throw new Error(`${label} is missing required integration markers: ${missing.join(', ')}`);
  }
}

const manifest = JSON.parse(await readFile(new URL('../dist/manifest.json', import.meta.url), 'utf8'));
const referenced = [
  manifest.action.default_popup,
  manifest.options_page,
  manifest.background.service_worker,
  ...manifest.content_scripts.flatMap((script) => script.js),
  ...Object.values(manifest.icons)
];
await Promise.all(referenced.map(mustExist));

const sourceContent = await readFile(new URL('../src/content/content.ts', import.meta.url), 'utf8');
assertContains('src/content/content.ts', sourceContent, [
  'new OptiShieldOverlay',
  'overlay.start()',
  'OPTISHIELD_SETTINGS_UPDATED',
  'settingsStore.subscribe',
  'MutationObserver'
]);

const builtContent = await readFile(new URL('../dist/content.js', import.meta.url), 'utf8');
assertContains('dist/content.js', builtContent, [
  'optishield-overlay',
  'requestAnimationFrame',
  'chrome.storage.onChanged',
  'chrome.runtime.onMessage.addListener',
  'OPTISHIELD_SETTINGS_UPDATED',
  'OPTISHIELD_STATS',
  "getContext('webgl2'",
  "getContext('2d'",
  'Canvas fallback keeps protection active'
]);

const popup = await readFile(new URL('../dist/popup.js', import.meta.url), 'utf8');
assertContains('dist/popup.js', popup, [
  'chrome.runtime.sendMessage',
  'OPTISHIELD_SETTINGS_UPDATED',
  'chrome.storage.local.set',
  'OPTISHIELD_GET_STATS'
]);

console.log('extension wiring verified');
