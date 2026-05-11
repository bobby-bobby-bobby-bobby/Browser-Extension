import type { DistortionStyle, PerturbationSettings } from '../types/settings';

export interface PerturbationFrameConfig {
  alpha: number;
  jitterPx: number;
  edgePx: number;
  chromaPx: number;
  frequencyAlpha: number;
  temporalSeed: number;
  temporalPhase: number;
  qualityScale: number;
  warpPx: number;
  warpSpeed: number;
  warpDensity: number;
  warpCurvature: number;
  warpStyleScale: number;
}

export function frameConfig(settings: PerturbationSettings, frame: number, time: number, qualityScale = 1): PerturbationFrameConfig {
  const eyeStrainScale = settings.lowEyeStrain ? 0.68 : 1;
  const motionScale = settings.reducedMotion ? 0.22 : 1;
  const dyslexiaScale = settings.dyslexiaFriendly ? 0.55 : 1;
  const base = (settings.intensity / 100) * eyeStrainScale * qualityScale;
  const temporalPhase = settings.adaptiveTemporalPhaseShifting ? Math.sin(frame * 0.73 + time * 0.0021) : 0;
  const warpStyleScale = styleScale(settings.distortionStyle);
  const warpPx = Math.min(3, (settings.warpAmplitude / 100) * 3 * eyeStrainScale * motionScale * warpStyleScale * qualityScale);
  return {
    alpha: Math.min(0.16, 0.035 + base * 0.24),
    jitterPx: base * (settings.jitter / 100) * 0.9 * motionScale * dyslexiaScale,
    edgePx: base * (settings.edgeInstability / 100) * 1.2 * motionScale,
    chromaPx: settings.subpixelChromaDrift ? 0.35 + base * 0.95 * (1 + temporalPhase * 0.18) : 0,
    frequencyAlpha: settings.compressionInterferencePatterns ? Math.min(0.10, 0.012 + base * (settings.frequencyDisruption / 100) * 0.22) : 0,
    temporalSeed: Math.sin(frame * 12.9898 + time * 0.001) * 43758.5453,
    temporalPhase,
    qualityScale,
    warpPx,
    warpSpeed: (settings.reducedMotion ? 0.12 : 1) * (0.035 + settings.warpSpeed / 100),
    warpDensity: 0.0025 + (settings.warpDensity / 100) * 0.014,
    warpCurvature: (settings.warpCurvature / 100) * warpStyleScale,
    warpStyleScale
  };
}

function styleScale(style: DistortionStyle): number {
  switch (style) {
    case 'linear': return 0.35;
    case 'adaptive': return 0.78;
    case 'cameraHardened': return 1;
    case 'organic':
    default: return 0.62;
  }
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function hash2(x: number, y: number): number {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
}

function fract(value: number): number {
  return value - Math.floor(value);
}

export function valueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = smoothstep(fx);
  const uy = smoothstep(fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  const x1 = a + (b - a) * ux;
  const x2 = c + (d - c) * ux;
  return x1 + (x2 - x1) * uy;
}

export function layeredWarp(x: number, y: number, time: number, config: PerturbationFrameConfig): number {
  if (config.warpPx <= 0) return 0;
  const drift = time * 0.00018 * config.warpSpeed;
  const large = valueNoise2D(x * config.warpDensity + drift, y * config.warpDensity * 0.72 - drift * 0.63);
  const micro = valueNoise2D(x * config.warpDensity * 5.1 - drift * 2.7, y * config.warpDensity * 4.3 + drift * 3.1);
  const curved = valueNoise2D((x + large * 9) * config.warpDensity * 1.7, (y + micro * 7) * config.warpDensity * 1.3 + drift);
  return ((large - 0.5) * 0.68 + (micro - 0.5) * 0.18 + (curved - 0.5) * 0.28 * config.warpCurvature) * config.warpPx;
}
