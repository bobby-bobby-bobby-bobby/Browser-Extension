import type { PerturbationSettings } from '../../types/settings';
import { frameConfig } from '../perturbation-config';

export class CanvasPerturbationRenderer {
  readonly kind = 'canvas2d' as const;
  private ctx: CanvasRenderingContext2D;
  private frame = 0;
  private cssWidth = 0;
  private cssHeight = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!context) throw new Error('Canvas 2D is unavailable');
    this.ctx = context;
  }

  resize(width: number, height: number): void {
    this.cssWidth = width;
    this.cssHeight = height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(settings: PerturbationSettings, time: number, qualityScale = 1): void {
    const width = this.cssWidth;
    const height = this.cssHeight;
    if (width <= 0 || height <= 0) return;
    const config = frameConfig(settings, this.frame++, time, qualityScale);
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.globalCompositeOperation = 'source-over';

    if (settings.compressionInterferencePatterns) {
      const spacing = Math.max(9, 24 - settings.frequencyDisruption * 0.13);
      for (let y = (Math.abs(config.temporalSeed) % spacing) - spacing; y < height; y += spacing) {
        const offset = Math.sin(y * 0.073 + time * 0.0017 + config.temporalPhase) * config.jitterPx;
        this.ctx.fillStyle = `rgba(255,255,255,${config.frequencyAlpha})`;
        this.ctx.fillRect(offset, y, width, 1);
        this.ctx.fillStyle = `rgba(2,8,23,${config.frequencyAlpha * 0.75})`;
        this.ctx.fillRect(-offset, y + 2, width, 1);
      }
    }

    if (settings.edgeReconstructionPoisoning) {
      const block = Math.max(36, 86 - settings.ocrDisruption * 0.36);
      this.ctx.fillStyle = `rgba(15,23,42,${config.alpha * 0.38})`;
      for (let x = -block; x < width + block; x += block) {
        const phase = Math.sin(x * 0.031 + time * 0.0011) * config.edgePx;
        this.ctx.fillRect(x + phase, 0, 1, height);
      }
      this.ctx.fillStyle = `rgba(248,250,252,${config.alpha * 0.30})`;
      for (let y = -block; y < height + block; y += block) {
        const phase = Math.cos(y * 0.027 + time * 0.0013) * config.edgePx;
        this.ctx.fillRect(0, y + phase, width, 1);
      }
    }

    if (settings.subpixelChromaDrift) {
      this.ctx.globalAlpha = config.alpha;
      this.ctx.fillStyle = 'rgba(94,234,212,0.55)';
      this.ctx.fillRect(config.chromaPx, 0, width, height);
      this.ctx.fillStyle = 'rgba(129,140,248,0.42)';
      this.ctx.fillRect(-config.chromaPx, 0, width, height);
      this.ctx.globalAlpha = 1;
    }
  }

  dispose(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
