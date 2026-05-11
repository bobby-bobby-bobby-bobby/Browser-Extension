import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ShieldCheck } from 'lucide-react';
import { Slider } from '../ui/Slider';
import { useSettings } from '../ui/hooks/use-settings';
import '../ui/styles.css';
import type { PerformanceStats, PerturbationSettings } from '../types/settings';
import { DEFAULT_STATS } from '../storage/defaults';

function Popup() {
  const { settings, setSettings } = useSettings();
  const [stats, setStats] = useState<PerformanceStats>(DEFAULT_STATS);

  useEffect(() => {
    const listener = (message: { type?: string; stats?: PerformanceStats }) => {
      if (message.type === 'OPTISHIELD_STATS' && message.stats) setStats(message.stats);
    };
    chrome.runtime.onMessage.addListener(listener);
    void chrome.runtime.sendMessage({ type: 'OPTISHIELD_GET_STATS' }).then((response) => {
      if (response?.stats) setStats(response.stats);
    }).catch(() => undefined);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const updateSettings = async (patch: Partial<PerturbationSettings>) => {
    const next = await setSettings(patch);
    await chrome.runtime.sendMessage({ type: 'OPTISHIELD_SETTINGS_UPDATED', settings: next }).catch(() => undefined);
  };

  return (
    <main className="app">
      <header className="header">
        <div className="brand"><h1>OptiShield</h1><span>Optical Privacy for the Modern Web</span></div>
        <button className={`toggle ${settings.enabled ? '' : 'off'}`} onClick={() => void updateSettings({ enabled: !settings.enabled })}>
          {settings.enabled ? 'On' : 'Off'}
        </button>
      </header>
      <section className="card stats" aria-label="Performance stats">
        <div className="stat"><b>{stats.fps}</b><span>FPS</span></div>
        <div className="stat"><b>{stats.frameMs}</b><span>ms/frame</span></div>
        <div className="stat"><b>{stats.renderer}</b><span>current renderer</span></div>
        <div className="stat"><b>{Math.round(stats.qualityScale * 100)}%</b><span>quality</span></div>
        <div className="stat"><b>{stats.perturbationStrength}%</b><span>strength</span></div>
        <div className="stat"><b>{stats.ocrResistance}%</b><span>OCR resistance</span></div>
      </section>
      <section className="card grid">
        <label className="control"><span>Rendering mode</span><select value={settings.mode} onChange={(e) => void updateSettings({ mode: e.target.value as typeof settings.mode })}><option value="auto">Auto recommended</option><option value="canvas2d">Canvas 2D</option><option value="webgl">WebGL</option></select></label>
        <Slider label="Overall intensity" value={settings.intensity} onChange={(intensity) => void updateSettings({ intensity })} help="Higher values increase optical disruption but may become more visible." />
        <Slider label="Subpixel jitter" value={settings.jitter} onChange={(jitter) => void updateSettings({ jitter })} />
        <Slider label="Edge instability" value={settings.edgeInstability} onChange={(edgeInstability) => void updateSettings({ edgeInstability })} />
        <Slider label="OCR disruption" value={settings.ocrDisruption} onChange={(ocrDisruption) => void updateSettings({ ocrDisruption })} />
        <Slider label="Frequency disruption" value={settings.frequencyDisruption} onChange={(frequencyDisruption) => void updateSettings({ frequencyDisruption })} />
      </section>
      <section className="card grid">
        <label className="check"><input type="checkbox" checked={settings.adaptiveTemporalPhaseShifting} onChange={(e) => void updateSettings({ adaptiveTemporalPhaseShifting: e.target.checked })} /> Adaptive temporal phase shifting</label>
        <label className="check"><input type="checkbox" checked={settings.subpixelChromaDrift} onChange={(e) => void updateSettings({ subpixelChromaDrift: e.target.checked })} /> Subpixel chroma drift</label>
        <label className="check"><input type="checkbox" checked={settings.edgeReconstructionPoisoning} onChange={(e) => void updateSettings({ edgeReconstructionPoisoning: e.target.checked })} /> Edge reconstruction poisoning</label>
        <label className="check"><input type="checkbox" checked={settings.compressionInterferencePatterns} onChange={(e) => void updateSettings({ compressionInterferencePatterns: e.target.checked })} /> Compression interference patterns</label>
      </section>
      <section className="card grid">
        <label className="check"><input type="checkbox" checked={settings.lowEyeStrain} onChange={(e) => void updateSettings({ lowEyeStrain: e.target.checked })} /> Low eye strain</label>
        <label className="check"><input type="checkbox" checked={settings.reducedMotion} onChange={(e) => void updateSettings({ reducedMotion: e.target.checked })} /> Reduced motion</label>
        <label className="check"><input type="checkbox" checked={settings.dyslexiaFriendly} onChange={(e) => void updateSettings({ dyslexiaFriendly: e.target.checked })} /> Dyslexia-friendly tuning</label>
        <label className="check"><input type="checkbox" checked={settings.debugPanel} onChange={(e) => void updateSettings({ debugPanel: e.target.checked })} /> Local debugging panel</label>
      </section>
      <p className="footer"><ShieldCheck size={14} /> Local-only settings. <Activity size={14} /> No telemetry, accounts, analytics, or remote code.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
