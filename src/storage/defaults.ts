import type { PerturbationSettings, PerformanceStats } from '../types/settings';

export const DEFAULT_SETTINGS: PerturbationSettings = {
  enabled: true,
  mode: 'auto',
  intensity: 32,
  jitter: 26,
  edgeInstability: 22,
  ocrDisruption: 20,
  frequencyDisruption: 18,
  reducedMotion: false,
  lowEyeStrain: true,
  dyslexiaFriendly: false,
  highContrastCompatible: true,
  disabledSites: []
};

export const DEFAULT_STATS: PerformanceStats = {
  fps: 60,
  frameMs: 16.7,
  droppedFrames: 0,
  recommendedMode: 'canvas2d',
  renderer: 'auto'
};
