import type { PerturbationSettings } from '../types/settings';

export interface PerturbationFrameConfig {
  alpha: number;
  jitterPx: number;
  edgePx: number;
  chromaPx: number;
  frequencyAlpha: number;
  temporalSeed: number;
  temporalPhase: number;
  qualityScale: number;
}

export function frameConfig(settings: PerturbationSettings, frame: number, time: number, qualityScale = 1): PerturbationFrameConfig {
  const eyeStrainScale = settings.lowEyeStrain ? 0.68 : 1;
  const motionScale = settings.reducedMotion ? 0.22 : 1;
  const dyslexiaScale = settings.dyslexiaFriendly ? 0.55 : 1;
  const base = (settings.intensity / 100) * eyeStrainScale * qualityScale;
  const temporalPhase = settings.adaptiveTemporalPhaseShifting ? Math.sin(frame * 0.73 + time * 0.0021) : 0;
  return {
    alpha: Math.min(0.18, base * 0.22),
    jitterPx: base * (settings.jitter / 100) * 0.9 * motionScale * dyslexiaScale,
    edgePx: base * (settings.edgeInstability / 100) * 1.2 * motionScale,
    chromaPx: settings.subpixelChromaDrift ? base * 0.55 * (1 + temporalPhase * 0.18) : 0,
    frequencyAlpha: settings.compressionInterferencePatterns ? base * (settings.frequencyDisruption / 100) * 0.16 : 0,
    temporalSeed: Math.sin(frame * 12.9898 + time * 0.001) * 43758.5453,
    temporalPhase,
    qualityScale
  };
}
