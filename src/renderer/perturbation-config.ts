import type { PerturbationSettings } from '../types/settings';

export interface PerturbationFrameConfig {
  alpha: number;
  jitterPx: number;
  edgePx: number;
  chromaPx: number;
  frequencyAlpha: number;
  temporalSeed: number;
}

export function frameConfig(settings: PerturbationSettings, frame: number, time: number): PerturbationFrameConfig {
  const eyeStrainScale = settings.lowEyeStrain ? 0.68 : 1;
  const motionScale = settings.reducedMotion ? 0.22 : 1;
  const dyslexiaScale = settings.dyslexiaFriendly ? 0.55 : 1;
  const base = (settings.intensity / 100) * eyeStrainScale;
  return {
    alpha: Math.min(0.18, base * 0.22),
    jitterPx: base * (settings.jitter / 100) * 0.9 * motionScale * dyslexiaScale,
    edgePx: base * (settings.edgeInstability / 100) * 1.2 * motionScale,
    chromaPx: base * 0.55,
    frequencyAlpha: base * (settings.frequencyDisruption / 100) * 0.16,
    temporalSeed: Math.sin(frame * 12.9898 + time * 0.001) * 43758.5453
  };
}
