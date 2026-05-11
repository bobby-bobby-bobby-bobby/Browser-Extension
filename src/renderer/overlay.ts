import { CanvasPerturbationRenderer } from './canvas/canvas-renderer';
import { PerformanceManager } from './performance-manager';
import { WebGLPerturbationRenderer } from './webgl/webgl-renderer';
import type { PerformanceStats, PerturbationSettings, RenderingMode } from '../types/settings';

type Renderer = CanvasPerturbationRenderer | WebGLPerturbationRenderer;
const STATS_PUBLISH_HZ = 3;
const STATS_PUBLISH_INTERVAL_MS = Math.floor(1000 / STATS_PUBLISH_HZ);

export class OptiShieldOverlay {
  private root: HTMLElement;
  private shadow: ShadowRoot;
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private animationId = 0;
  private stats: PerformanceStats = PerformanceManager.defaultStats();
  private manager = new PerformanceManager();
  private frame = 0;
  private lastStatsPublishedAt = -Infinity;
  private resizeObserver: ResizeObserver;
  private debugPanel: HTMLDivElement;
  private debugPanelStylesApplied = false;

  constructor(private settings: PerturbationSettings, private onStats: (stats: PerformanceStats) => void) {
    this.root = document.createElement('optishield-root');
    this.root.id = 'optishield-root';
    this.shadow = this.root.attachShadow({ mode: 'open' });
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'optishield-overlay';
    this.debugPanel = document.createElement('div');
    this.debugPanel.id = 'optishield-debug-panel';
    this.shadow.append(this.canvas, this.debugPanel);
    this.applyTopOverlayStyles();
    document.documentElement.append(this.root);
    this.renderer = this.createRenderer(settings.mode === 'auto' ? 'canvas2d' : settings.mode);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(document.documentElement);
    this.resize();
    this.syncDebugPanel();
  }

  start(): void {
    const tick = (now: number) => {
      this.frame += 1;
      if (this.frame % 30 === 0) this.ensureTopmost();
      if (this.settings.enabled && this.manager.shouldRender(this.frame)) {
        this.renderer.render(this.settings, now, this.manager.currentQualityScale());
        this.stats = this.manager.sample(now, this.renderer.kind, this.settings);
        this.maybeSwitchAutoRenderer();
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
    this.root.remove();
  }

  private applyTopOverlayStyles(): void {
    const rootStyle = this.root.style;
    rootStyle.setProperty('all', 'initial', 'important');
    rootStyle.setProperty('position', 'fixed', 'important');
    rootStyle.setProperty('inset', '0', 'important');
    rootStyle.setProperty('width', '100vw', 'important');
    rootStyle.setProperty('height', '100vh', 'important');
    rootStyle.setProperty('pointer-events', 'none', 'important');
    rootStyle.setProperty('z-index', '2147483647', 'important');
    rootStyle.setProperty('display', 'block', 'important');
    rootStyle.setProperty('visibility', 'visible', 'important');
    rootStyle.setProperty('opacity', '1', 'important');
    rootStyle.setProperty('contain', 'strict', 'important');
    rootStyle.setProperty('isolation', 'isolate', 'important');

    const canvasStyle = this.canvas.style;
    canvasStyle.setProperty('all', 'initial', 'important');
    canvasStyle.setProperty('position', 'fixed', 'important');
    canvasStyle.setProperty('inset', '0', 'important');
    canvasStyle.setProperty('width', '100vw', 'important');
    canvasStyle.setProperty('height', '100vh', 'important');
    canvasStyle.setProperty('pointer-events', 'none', 'important');
    canvasStyle.setProperty('z-index', '2147483647', 'important');
    canvasStyle.setProperty('display', 'block', 'important');
    canvasStyle.setProperty('visibility', 'visible', 'important');
    canvasStyle.setProperty('opacity', '1', 'important');
    canvasStyle.setProperty('mix-blend-mode', this.settings.highContrastCompatible ? 'normal' : 'overlay', 'important');
    canvasStyle.setProperty('box-shadow', 'inset 0 0 0 1px rgba(94,234,212,.18)', 'important');
    canvasStyle.setProperty('contain', 'strict', 'important');
  }

  private applyDebugPanelStyles(): void {
    const style = this.debugPanel.style;
    style.setProperty('all', 'initial', 'important');
    style.setProperty('position', 'fixed', 'important');
    style.setProperty('right', '12px', 'important');
    style.setProperty('bottom', '12px', 'important');
    style.setProperty('z-index', '2147483647', 'important');
    style.setProperty('padding', '8px 10px', 'important');
    style.setProperty('border-radius', '10px', 'important');
    style.setProperty('background', 'rgba(2,6,23,.82)', 'important');
    style.setProperty('color', '#dbeafe', 'important');
    style.setProperty('font', '12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace', 'important');
    style.setProperty('pointer-events', 'none', 'important');
    style.setProperty('box-shadow', '0 8px 28px rgba(0,0,0,.28)', 'important');
  }

  private ensureTopmost(): void {
    if (this.root.parentElement !== document.documentElement) {
      document.documentElement.append(this.root);
    } else if (document.documentElement.lastElementChild !== this.root) {
      document.documentElement.append(this.root);
    }
  }

  private resize(): void {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  private syncDebugPanel(): void {
    this.debugPanel.hidden = !this.settings.debugPanel;
    if (this.debugPanel.hidden) return;
    if (!this.debugPanelStylesApplied) {
      this.applyDebugPanelStyles();
      this.debugPanelStylesApplied = true;
    }
    this.debugPanel.textContent = `OptiShield | ${this.stats.renderer} | ${this.stats.fps} FPS | ${this.stats.frameMs} ms | quality ${Math.round(this.stats.qualityScale * 100)}% | strength ${this.stats.perturbationStrength}% | OCR resistance ${this.stats.ocrResistance}%`;
  }

  private maybeSwitchAutoRenderer(): void {
    if (this.settings.mode !== 'auto' || this.stats.recommendedMode === this.renderer.kind) return;
    this.renderer.dispose();
    this.renderer = this.createRenderer(this.stats.recommendedMode);
    this.resize();
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
    this.canvas.replaceWith(replacement);
    this.canvas = replacement;
    this.shadow.prepend(this.canvas);
    this.applyTopOverlayStyles();
  }
}
