import type { PerturbationSettings, PerformanceStats } from '../types/settings';

export const DEFAULT_SETTINGS: PerturbationSettings = {
  enabled: true,
  mode: 'auto',
  intensity: 50,
  jitter: 40,
  edgeInstability: 38,
  ocrDisruption: 34,
  frequencyDisruption: 32,
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

export const DEFAULT_STATS: PerformanceStats = {
  fps: 60,
  frameMs: 16.7,
  droppedFrames: 0,
  recommendedMode: 'canvas2d',
  renderer: 'auto',
  qualityScale: 1,
  perturbationStrength: DEFAULT_SETTINGS.intensity,
  ocrResistance: 54
};
