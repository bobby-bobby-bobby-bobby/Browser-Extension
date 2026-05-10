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
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(settings: PerturbationSettings, time: number): void {
    const width = this.cssWidth;
    const height = this.cssHeight;
    if (width <= 0 || height <= 0) return;
    const config = frameConfig(settings, this.frame++, time);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalCompositeOperation = 'source-over';

    // Sparse, low-alpha bands disrupt frame averaging and low-bitrate edge recovery without obscuring text.
    const spacing = Math.max(10, 22 - settings.frequencyDisruption * 0.12);
    for (let y = (config.temporalSeed % spacing) - spacing; y < height; y += spacing) {
      const offset = Math.sin(y * 0.073 + time * 0.0017) * config.jitterPx;
      this.ctx.fillStyle = `rgba(255,255,255,${config.frequencyAlpha})`;
      this.ctx.fillRect(offset, y, width, 1);
      this.ctx.fillStyle = `rgba(2,8,23,${config.frequencyAlpha * 0.8})`;
      this.ctx.fillRect(-offset, y + 2, width, 1);
    }

    // Micro chroma offsets exploit camera demosaicing and compression while staying below obvious flicker.
    this.ctx.globalAlpha = config.alpha;
    this.ctx.fillStyle = 'rgba(94,234,212,0.55)';
    this.ctx.fillRect(config.chromaPx, 0, width, height);
    this.ctx.fillStyle = 'rgba(129,140,248,0.42)';
    this.ctx.fillRect(-config.chromaPx, 0, width, height);
    this.ctx.globalAlpha = 1;
  }

  dispose(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
