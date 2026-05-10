import { createWorker } from 'tesseract.js';

export interface OcrBenchmarkResult {
  confidence: number;
  textLength: number;
  visualLeakageScore: number;
  durationMs: number;
}

export async function runOcrBenchmark(canvas: HTMLCanvasElement): Promise<OcrBenchmarkResult> {
  const started = performance.now();
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(canvas);
    const confidence = result.data.confidence ?? 0;
    return {
      confidence,
      textLength: result.data.text.trim().length,
      visualLeakageScore: Math.max(0, Math.min(100, confidence * 0.7 + result.data.text.trim().length * 0.05)),
      durationMs: Math.round(performance.now() - started)
    };
  } finally {
    await worker.terminate();
  }
}

export function drawBenchmarkSample(canvas: HTMLCanvasElement, text = 'OptiShield optical privacy benchmark sample'): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = 960;
  canvas.height = 320;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f172a';
  ctx.font = '42px system-ui, sans-serif';
  ctx.fillText(text, 42, 120);
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('Local-only OCR confidence check. No data leaves this browser.', 42, 190);
}
