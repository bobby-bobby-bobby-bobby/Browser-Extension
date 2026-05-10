import type { PerformanceStats, RenderingMode } from '../types/settings';
import { DEFAULT_STATS } from '../storage/defaults';

export class PerformanceManager {
  private samples: number[] = [];
  private last = performance.now();
  private droppedFrames = 0;
  private visibilityPaused = document.hidden;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      this.visibilityPaused = document.hidden;
    });
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

  private recommend(avgFrameMs: number): RenderingMode {
    const hasWebGl = Boolean(document.createElement('canvas').getContext('webgl2'));
    if (!hasWebGl) return 'canvas2d';
    if (avgFrameMs > 28) return 'canvas2d';
    return 'webgl';
  }

  static defaultStats(): PerformanceStats {
    return DEFAULT_STATS;
  }
}
