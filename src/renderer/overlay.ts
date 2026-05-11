import { CanvasPerturbationRenderer } from './canvas/canvas-renderer';
import { PerformanceManager } from './performance-manager';
import { WebGLPerturbationRenderer } from './webgl/webgl-renderer';
import type { PerformanceStats, PerturbationSettings, RenderingMode } from '../types/settings';

type Renderer = CanvasPerturbationRenderer | WebGLPerturbationRenderer;
const STATS_PUBLISH_HZ = 3;
const STATS_PUBLISH_INTERVAL_MS = Math.floor(1000 / STATS_PUBLISH_HZ);

export class OptiShieldOverlay {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private animationId = 0;
  private stats: PerformanceStats = PerformanceManager.defaultStats();
  private manager = new PerformanceManager();
  private frame = 0;
  private lastStatsPublishedAt = -Infinity;
  private resizeObserver: ResizeObserver;
  private debugPanel: HTMLDivElement;

  constructor(private settings: PerturbationSettings, private onStats: (stats: PerformanceStats) => void) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'optishield-overlay';
    this.applyTopOverlayStyles();
    this.debugPanel = document.createElement('div');
    this.debugPanel.id = 'optishield-debug-panel';
    Object.assign(this.debugPanel.style, {
      position: 'fixed',
      right: '12px',
      bottom: '12px',
      zIndex: '2147483647',
      padding: '8px 10px',
      borderRadius: '10px',
      background: 'rgba(2,6,23,.82)',
      color: '#dbeafe',
      font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
      pointerEvents: 'none',
      boxShadow: '0 8px 28px rgba(0,0,0,.28)'
    });
    document.documentElement.append(this.canvas, this.debugPanel);
    this.renderer = this.createRenderer(settings.mode);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(document.documentElement);
    this.resize();
    this.syncDebugPanel();
  }

  start(): void {
    const tick = (now: number) => {
      this.frame += 1;
      if (this.frame % 60 === 0) this.ensureTopmost();
      if (this.settings.enabled && this.manager.shouldRender(this.frame)) {
        this.renderer.render(this.settings, now, this.manager.currentQualityScale());
        this.stats = this.manager.sample(now, this.renderer.kind, this.settings);
        this.syncDebugPanel();
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
    this.applyTopOverlayStyles();
    if (previousMode !== settings.mode || (settings.mode === 'auto' && this.stats.recommendedMode !== this.renderer.kind)) {
      this.renderer.dispose();
      this.renderer = this.createRenderer(settings.mode === 'auto' ? this.stats.recommendedMode : settings.mode);
      this.resize();
    }
    this.syncDebugPanel();
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    this.manager.dispose();
    this.renderer.dispose();
    this.canvas.remove();
    this.debugPanel.remove();
  }


  private applyTopOverlayStyles(): void {
    const style = this.canvas.style;
    style.setProperty('all', 'initial', 'important');
    style.setProperty('position', 'fixed', 'important');
    style.setProperty('inset', '0', 'important');
    style.setProperty('width', '100vw', 'important');
    style.setProperty('height', '100vh', 'important');
    style.setProperty('pointer-events', 'none', 'important');
    style.setProperty('z-index', '2147483647', 'important');
    style.setProperty('display', 'block', 'important');
    style.setProperty('visibility', 'visible', 'important');
    style.setProperty('opacity', '1', 'important');
    style.setProperty('mix-blend-mode', this.settings.highContrastCompatible ? 'normal' : 'overlay', 'important');
    style.setProperty('box-shadow', 'inset 0 0 0 1px rgba(94,234,212,.18)', 'important');
    style.setProperty('contain', 'strict', 'important');
    style.setProperty('isolation', 'isolate', 'important');
  }

  private ensureTopmost(): void {
    if (this.canvas.parentElement !== document.documentElement || this.canvas.nextElementSibling !== this.debugPanel) {
      document.documentElement.append(this.canvas, this.debugPanel);
    }
  }

  private resize(): void {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  private syncDebugPanel(): void {
    this.debugPanel.hidden = !this.settings.debugPanel;
    if (this.debugPanel.hidden) return;
    this.debugPanel.textContent = `OptiShield | ${this.stats.renderer} | ${this.stats.fps} FPS | ${this.stats.frameMs} ms | quality ${Math.round(this.stats.qualityScale * 100)}% | strength ${this.stats.perturbationStrength}% | OCR resistance ${this.stats.ocrResistance}%`;
  }

  private createRenderer(mode: RenderingMode): Renderer {
    if (mode === 'webgl') {
      try {
        return new WebGLPerturbationRenderer(this.canvas);
      } catch {
        this.replaceCanvasForCanvasFallback();
        // Fallback is intentional: privacy controls should remain available on devices without WebGL2.
      }
    }
    return new CanvasPerturbationRenderer(this.canvas);
  }

  private replaceCanvasForCanvasFallback(): void {
    const replacement = document.createElement('canvas');
    replacement.id = this.canvas.id;
    replacement.setAttribute('style', this.canvas.getAttribute('style') ?? '');
    this.canvas.replaceWith(replacement);
    this.canvas = replacement;
    this.applyTopOverlayStyles();
  }
}
