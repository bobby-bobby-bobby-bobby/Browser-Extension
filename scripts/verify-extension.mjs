import { readFile, stat } from 'node:fs/promises';

const repoRoot = new URL('../', import.meta.url);
const distRoot = new URL('../dist/', import.meta.url);
const POPUP_VITE_SCRIPT_PATTERN = /src=["']\/?(assets\/popup-[^"']+\.js)["']/;

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
  await verifyPageAssets(`${label}/${manifest.action.default_popup}`, root, popupHtml, {
    legacyMarkers: ['popup.css', 'popup.js'],
    viteScriptPattern: POPUP_VITE_SCRIPT_PATTERN,
    viteStylePattern: /href=["']\/?(assets\/[^"']+\.css)["']/
  });

  const optionsHtml = await readFile(new URL(manifest.options_page, root), 'utf8');
  await verifyPageAssets(`${label}/${manifest.options_page}`, root, optionsHtml, {
    legacyMarkers: ['popup.css', 'options.js'],
    viteScriptPattern: /src=["']\/?(assets\/options-[^"']+\.js)["']/,
    viteStylePattern: /href=["']\/?(assets\/[^"']+\.css)["']/
  });

  return { manifest, popupHtml };
}

const repoVerified = await verifyManifestRoot('repo root', repoRoot);
const distVerified = await verifyManifestRoot('dist', distRoot);

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
    'webgl2',
    'getContext',
    'rgba(94,234,212',
    'intensity',
    'canvas2d',
    'gl.isContextLost()',
    'replaceCanvasForCanvasFallback',
    '2147483647',
    'ensureTopmost',
    'valueNoise2D',
    'layeredWarp',
    'distortionStyle',
    'float veil =',
    '0.19'
  ]);
}

for (const [label, root, popupHtml] of [['popup.js', repoRoot, repoVerified.popupHtml], ['dist/popup bundle', distRoot, distVerified.popupHtml]]) {
  const popupPath = popupHtml.includes('popup.js') ? 'popup.js' : extractViteScriptPath(popupHtml, POPUP_VITE_SCRIPT_PATTERN);
  const popup = await readFile(new URL(popupPath, root), 'utf8');
  assertContains(label, popup, [
    'chrome.runtime.sendMessage',
    'OPTISHIELD_SETTINGS_UPDATED',
    'OPTISHIELD_GET_STATS'
  ]);
}

console.log('extension wiring verified for repo root and dist');

function extractViteScriptPath(html, pattern) {
  const match = html.match(pattern);
  if (!match?.[1]) throw new Error(`Missing expected Vite script reference for pattern: ${String(pattern)}`);
  return match[1];
}

function normalizeRef(ref) {
  return ref.replace(/^\/+/, '');
}

function extractLocalRefs(html) {
  return [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((ref) => !/^https?:\/\//.test(ref) && !ref.startsWith('data:'))
    .map(normalizeRef);
}

async function verifyPageAssets(label, root, html, config) {
  const hasLegacy = config.legacyMarkers.every((marker) => html.includes(marker));
  const hasVite = config.viteScriptPattern.test(html) && config.viteStylePattern.test(html);

  if (!hasLegacy && !hasVite) {
    throw new Error(`${label} is missing expected legacy or Vite asset wiring`);
  }

  if (hasLegacy) {
    await Promise.all(config.legacyMarkers.map((marker) => mustExist(root, marker)));
    return;
  }

  const localRefs = extractLocalRefs(html);
  await Promise.all(localRefs.map((ref) => mustExist(root, ref)));
}
