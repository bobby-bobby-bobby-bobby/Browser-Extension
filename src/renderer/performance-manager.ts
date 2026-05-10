import type { PerformanceStats, RenderingMode } from '../types/settings';
import { DEFAULT_STATS } from '../storage/defaults';

export class PerformanceManager {
  private static cachedWebGl2Support: boolean | undefined;
  private samples: number[] = [];
  private last = performance.now();
  private droppedFrames = 0;
  private visibilityPaused = document.hidden;
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

  shouldRender(): boolean {
    return !this.visibilityPaused;
  }

  sample(now: number, renderer: RenderingMode): PerformanceStats {
    const delta = now - this.last;
    this.last = now;
    if (delta > 34) this.droppedFrames += 1;
    this.samples.push(delta);
    if (this.samples.length > 90) this.samples.shift();
    const avg = this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length || 16.7;
    return {
      fps: Math.round(1000 / avg),
      frameMs: Number(avg.toFixed(2)),
      droppedFrames: this.droppedFrames,
      recommendedMode: this.recommend(avg),
      renderer
    };
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
