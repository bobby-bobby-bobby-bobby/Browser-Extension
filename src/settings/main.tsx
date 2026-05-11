import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Slider } from '../ui/Slider';
import { useSettings } from '../ui/hooks/use-settings';
import { drawBenchmarkSample, runOcrBenchmark, type OcrBenchmarkResult } from '../benchmark/ocr-benchmark';
import '../ui/styles.css';

function SettingsApp() {
  const { settings, setSettings } = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [benchmark, setBenchmark] = useState<OcrBenchmarkResult | undefined>();
  const disabledText = settings.disabledSites.join('\n');

  const runBenchmark = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawBenchmarkSample(canvas);
    setBenchmark(await runOcrBenchmark(canvas));
  };

  return (
    <main className="app" style={{ maxWidth: 920, margin: '0 auto' }}>
      <header className="header"><div className="brand"><h1>OptiShield Settings</h1><span>Privacy-first optical capture resistance controls</span></div></header>
      <section className="card grid">
        <Slider label="Overall intensity" value={settings.intensity} onChange={(intensity) => void setSettings({ intensity })} />
        <Slider label="Subpixel jitter" value={settings.jitter} onChange={(jitter) => void setSettings({ jitter })} />
        <Slider label="Edge instability" value={settings.edgeInstability} onChange={(edgeInstability) => void setSettings({ edgeInstability })} />
        <Slider label="OCR disruption" value={settings.ocrDisruption} onChange={(ocrDisruption) => void setSettings({ ocrDisruption })} />
        <Slider label="Frequency disruption" value={settings.frequencyDisruption} onChange={(frequencyDisruption) => void setSettings({ frequencyDisruption })} />
      </section>
      <section className="card grid">
        <h2>Adaptive protection modes</h2>
        <label className="check"><input type="checkbox" checked={settings.adaptiveTemporalPhaseShifting} onChange={(e) => void setSettings({ adaptiveTemporalPhaseShifting: e.target.checked })} /> Adaptive temporal phase shifting</label>
        <label className="check"><input type="checkbox" checked={settings.subpixelChromaDrift} onChange={(e) => void setSettings({ subpixelChromaDrift: e.target.checked })} /> Subpixel chroma drift</label>
        <label className="check"><input type="checkbox" checked={settings.edgeReconstructionPoisoning} onChange={(e) => void setSettings({ edgeReconstructionPoisoning: e.target.checked })} /> Edge reconstruction poisoning</label>
        <label className="check"><input type="checkbox" checked={settings.compressionInterferencePatterns} onChange={(e) => void setSettings({ compressionInterferencePatterns: e.target.checked })} /> Compression interference patterns</label>
        <label className="check"><input type="checkbox" checked={settings.debugPanel} onChange={(e) => void setSettings({ debugPanel: e.target.checked })} /> Local developer diagnostics panel</label>
      </section>
      <section className="card grid">
        <h2>Per-site disable list</h2>
        <textarea rows={6} value={disabledText} placeholder="example.com" onChange={(event) => void setSettings({ disabledSites: event.target.value.split('\n').map((v) => v.trim().toLowerCase()).filter(Boolean) })} />
      </section>
      <section className="card grid">
        <h2>Local OCR benchmark</h2>
        <p className="footer">Runs Tesseract.js in this browser only to estimate OCR confidence and visual leakage. No sample data is uploaded.</p>
        <button className="toggle" onClick={() => void runBenchmark()}>Run benchmark</button>
        <canvas ref={canvasRef} style={{ width: '100%', borderRadius: 12, background: '#f8fafc' }} />
        {benchmark ? <div className="stats"><div className="stat"><b>{benchmark.confidence.toFixed(1)}</b><span>OCR confidence</span></div><div className="stat"><b>{benchmark.visualLeakageScore.toFixed(1)}</b><span>leakage score</span></div><div className="stat"><b>{benchmark.durationMs}</b><span>ms</span></div></div> : null}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<SettingsApp />);
