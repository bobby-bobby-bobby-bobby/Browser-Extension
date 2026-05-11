export type RenderingMode = 'canvas2d' | 'webgl' | 'auto';
export type DistortionStyle = 'linear' | 'organic' | 'adaptive' | 'cameraHardened';

export interface PerturbationSettings {
  enabled: boolean;
  mode: RenderingMode;
  intensity: number;
  jitter: number;
  edgeInstability: number;
  ocrDisruption: number;
  frequencyDisruption: number;
  distortionStyle: DistortionStyle;
  warpAmplitude: number;
  warpSpeed: number;
  warpDensity: number;
  warpCurvature: number;
  adaptiveTemporalPhaseShifting: boolean;
  subpixelChromaDrift: boolean;
  edgeReconstructionPoisoning: boolean;
  compressionInterferencePatterns: boolean;
  debugPanel: boolean;
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
  qualityScale: number;
  perturbationStrength: number;
  ocrResistance: number;
}

export interface RuntimeState {
  settings: PerturbationSettings;
  stats: PerformanceStats;
}

export type OptiShieldMessage =
  | { type: 'OPTISHIELD_SETTINGS_UPDATED'; settings: PerturbationSettings }
  | { type: 'OPTISHIELD_GET_SETTINGS' }
  | { type: 'OPTISHIELD_GET_STATS' }
  | { type: 'OPTISHIELD_STATS'; stats: PerformanceStats };
