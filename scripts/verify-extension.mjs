import { readFile, stat } from 'node:fs/promises';

const repoRoot = new URL('../', import.meta.url);
const distRoot = new URL('../dist/', import.meta.url);

async function mustExist(root, relativePath) {
  await stat(new URL(relativePath, root));
}

function assertContains(label, text, required) {
  const missing = required.filter((needle) => !text.includes(needle));
  if (missing.length) {
    throw new Error(`${label} is missing required integration markers: ${missing.join(', ')}`);
  }
}

async function verifyManifestRoot(label, root) {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  const referenced = [
    manifest.action.default_popup,
    manifest.options_page,
    manifest.background.service_worker,
    ...manifest.content_scripts.flatMap((script) => script.js),
    ...Object.values(manifest.icons)
  ];
  await Promise.all(referenced.map((file) => mustExist(root, file)));

  const popupHtml = await readFile(new URL(manifest.action.default_popup, root), 'utf8');
  assertContains(`${label}/${manifest.action.default_popup}`, popupHtml, ['popup.css', 'popup.js']);
  await mustExist(root, 'popup.css');
  await mustExist(root, 'popup.js');

  const optionsHtml = await readFile(new URL(manifest.options_page, root), 'utf8');
  assertContains(`${label}/${manifest.options_page}`, optionsHtml, ['popup.css', 'options.js']);
  await mustExist(root, 'options.js');

  return manifest;
}

await verifyManifestRoot('repo root', repoRoot);
await verifyManifestRoot('dist', distRoot);

const sourceContent = await readFile(new URL('../src/content/content.ts', import.meta.url), 'utf8');
assertContains('src/content/content.ts', sourceContent, [
  'new OptiShieldOverlay',
  'overlay.start()',
  'OPTISHIELD_SETTINGS_UPDATED',
  'settingsStore.subscribe',
  'MutationObserver'
]);

for (const [label, root] of [['content.js', repoRoot], ['dist/content.js', distRoot]]) {
  const builtContent = await readFile(new URL('content.js', root), 'utf8');
  assertContains(label, builtContent, [
    'optishield-root',
    'attachShadow',
    'optishield-overlay',
    'requestAnimationFrame',
    'chrome.storage.onChanged',
    'chrome.runtime.onMessage.addListener',
    'OPTISHIELD_SETTINGS_UPDATED',
    'OPTISHIELD_STATS',
    "getContext('webgl2'",
    "getContext('2d'",
    'Canvas fallback keeps protection active',
    'rgba(94,234,212,.18)',
    'intensity: 50',
    "mode: 'canvas2d'",
    'gl.isContextLost()',
    'replaceCanvasForCanvasFallback',
    "setProperty('z-index', '2147483647', 'important')",
    'ensureTopmost'
  ]);
}

for (const [label, root] of [['popup.js', repoRoot], ['dist/popup.js', distRoot]]) {
  const popup = await readFile(new URL('popup.js', root), 'utf8');
  assertContains(label, popup, [
    'chrome.runtime.sendMessage',
    'OPTISHIELD_SETTINGS_UPDATED',
    'chrome.storage.local.set',
    'OPTISHIELD_GET_STATS'
  ]);
}

console.log('extension wiring verified for repo root and dist');
