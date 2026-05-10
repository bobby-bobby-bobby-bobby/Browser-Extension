export type RenderingMode = 'canvas2d' | 'webgl' | 'auto';

export interface PerturbationSettings {
  enabled: boolean;
  mode: RenderingMode;
  intensity: number;
  jitter: number;
  edgeInstability: number;
  ocrDisruption: number;
  frequencyDisruption: number;
  reducedMotion: boolean;
  lowEyeStrain: boolean;
  dyslexiaFriendly: boolean;
  highContrastCompatible: boolean;
  disabledSites: string[];
}

export interface PerformanceStats {
  fps: number;
  frameMs: number;
  droppedFrames: number;
  recommendedMode: RenderingMode;
  renderer: RenderingMode;
}

export interface RuntimeState {
  settings: PerturbationSettings;
  stats: PerformanceStats;
}
