import type { PerformanceStats, PerturbationSettings, RenderingMode } from '../types/settings';
import { DEFAULT_STATS } from '../storage/defaults';

export class PerformanceManager {
  private static cachedWebGl2Support: boolean | undefined;
  private samples: number[] = [];
  private last = performance.now();
  private droppedFrames = 0;
  private visibilityPaused = document.hidden;
  private qualityScale = 1;
  private readonly hasWebGl2Support = PerformanceManager.getWebGl2Support();
  private readonly handleVisibilityChange = () => {
    this.visibilityPaused = document.hidden;
  };

  constructor() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  dispose(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  shouldRender(frame = 0): boolean {
    if (this.visibilityPaused) return false;
    if (this.qualityScale < 0.42) return frame % 3 === 0;
    if (this.qualityScale < 0.68) return frame % 2 === 0;
    return true;
  }

  sample(now: number, renderer: RenderingMode, settings: PerturbationSettings): PerformanceStats {
    const delta = now - this.last;
    this.last = now;
    if (delta > 34) this.droppedFrames += 1;
    this.samples.push(delta);
    if (this.samples.length > 90) this.samples.shift();
    const avg = this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length || 16.7;
    this.qualityScale = this.nextQuality(avg);
    const effectScore = this.effectScore(settings);
    return {
      fps: Math.max(1, Math.round(1000 / avg)),
      frameMs: Number(avg.toFixed(2)),
      droppedFrames: this.droppedFrames,
      recommendedMode: this.recommend(avg),
      renderer,
      qualityScale: Number(this.qualityScale.toFixed(2)),
      perturbationStrength: Math.round(effectScore * this.qualityScale),
      ocrResistance: Math.min(96, Math.round(effectScore * 0.86 + this.qualityScale * 18))
    };
  }

  currentQualityScale(): number {
    return this.qualityScale;
  }

  private nextQuality(avgFrameMs: number): number {
    if (avgFrameMs > 42) return Math.max(0.35, this.qualityScale - 0.14);
    if (avgFrameMs > 30) return Math.max(0.5, this.qualityScale - 0.08);
    if (avgFrameMs < 20) return Math.min(1, this.qualityScale + 0.04);
    return this.qualityScale;
  }

  private effectScore(settings: PerturbationSettings): number {
    const optionalModes = [
      settings.adaptiveTemporalPhaseShifting,
      settings.subpixelChromaDrift,
      settings.edgeReconstructionPoisoning,
      settings.compressionInterferencePatterns
    ].filter(Boolean).length;
    return Math.min(100, settings.intensity * 0.5 + settings.jitter * 0.12 + settings.edgeInstability * 0.14 + settings.ocrDisruption * 0.13 + settings.frequencyDisruption * 0.11 + optionalModes * 4);
  }

  private static getWebGl2Support(): boolean {
    if (PerformanceManager.cachedWebGl2Support !== undefined) return PerformanceManager.cachedWebGl2Support;
    PerformanceManager.cachedWebGl2Support = Boolean(document.createElement('canvas').getContext('webgl2'));
    return PerformanceManager.cachedWebGl2Support;
  }

  private recommend(avgFrameMs: number): RenderingMode {
    if (!this.hasWebGl2Support) return 'canvas2d';
    if (avgFrameMs > 28) return 'canvas2d';
    return 'webgl';
  }

  static defaultStats(): PerformanceStats {
    return DEFAULT_STATS;
  }
}
