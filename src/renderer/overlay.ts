import { CanvasPerturbationRenderer } from './canvas/canvas-renderer';
import { PerformanceManager } from './performance-manager';
import { WebGLPerturbationRenderer } from './webgl/webgl-renderer';
import type { PerformanceStats, PerturbationSettings, RenderingMode } from '../types/settings';

type Renderer = CanvasPerturbationRenderer | WebGLPerturbationRenderer;
const STATS_PUBLISH_INTERVAL_MS = Math.floor(1000 / 3);

export class OptiShieldOverlay {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private animationId = 0;
  private stats: PerformanceStats = PerformanceManager.defaultStats();
  private manager = new PerformanceManager();
  private lastStatsPublishedAt = 0;
  private resizeObserver: ResizeObserver;

  constructor(private settings: PerturbationSettings, private onStats: (stats: PerformanceStats) => void) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'optishield-overlay';
    Object.assign(this.canvas.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '2147483647',
      mixBlendMode: settings.highContrastCompatible ? 'soft-light' : 'overlay'
    });
    document.documentElement.appendChild(this.canvas);
    this.renderer = this.createRenderer(settings.mode);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(document.documentElement);
    this.resize();
  }

  start(): void {
    const tick = (now: number) => {
      if (this.settings.enabled && this.manager.shouldRender()) {
        this.renderer.render(this.settings, now);
        this.stats = this.manager.sample(now, this.renderer.kind);
        if (now - this.lastStatsPublishedAt >= STATS_PUBLISH_INTERVAL_MS) {
          this.lastStatsPublishedAt = now;
          this.onStats(this.stats);
        }
      }
      this.animationId = requestAnimationFrame(tick);
    };
    this.animationId = requestAnimationFrame(tick);
  }

  update(settings: PerturbationSettings): void {
    const previousMode = this.settings.mode;
    this.settings = settings;
    this.canvas.style.mixBlendMode = settings.highContrastCompatible ? 'soft-light' : 'overlay';
    if (previousMode !== settings.mode || (settings.mode === 'auto' && this.stats.recommendedMode !== this.renderer.kind)) {
      this.renderer.dispose();
      this.renderer = this.createRenderer(settings.mode === 'auto' ? this.stats.recommendedMode : settings.mode);
      this.resize();
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    this.manager.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }

  private resize(): void {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  private createRenderer(mode: RenderingMode): Renderer {
    if (mode !== 'canvas2d') {
      try {
        return new WebGLPerturbationRenderer(this.canvas);
      } catch {
        // Fallback is intentional: privacy controls should remain available on devices without WebGL2.
      }
    }
    return new CanvasPerturbationRenderer(this.canvas);
  }
}
