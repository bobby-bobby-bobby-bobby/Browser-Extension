(() => {
  'use strict';

  const STORAGE_KEY = 'optishield.settings';
  const DEFAULT_SETTINGS = {
    enabled: true,
    mode: 'auto',
    intensity: 50,
    jitter: 40,
    edgeInstability: 38,
    ocrDisruption: 34,
    frequencyDisruption: 32,
    adaptiveTemporalPhaseShifting: true,
    subpixelChromaDrift: true,
    edgeReconstructionPoisoning: true,
    compressionInterferencePatterns: true,
    debugPanel: false,
    reducedMotion: false,
    lowEyeStrain: true,
    dyslexiaFriendly: false,
    highContrastCompatible: true,
    disabledSites: []
  };

  function normalizedHost() {
    return window.location.hostname.replace(/^www\./, '').toLowerCase();
  }

  function isSiteDisabled(disabledSites) {
    const host = normalizedHost();
    return disabledSites.some((site) => host === site || host.endsWith(`.${site}`));
  }

  async function getSettings() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEY] || {}) };
  }

  function frameConfig(settings, frame, time, qualityScale) {
    const eyeStrainScale = settings.lowEyeStrain ? 0.68 : 1;
    const motionScale = settings.reducedMotion ? 0.22 : 1;
    const dyslexiaScale = settings.dyslexiaFriendly ? 0.55 : 1;
    const base = (settings.intensity / 100) * eyeStrainScale * qualityScale;
    const temporalPhase = settings.adaptiveTemporalPhaseShifting ? Math.sin(frame * 0.73 + time * 0.0021) : 0;
    return {
      alpha: Math.min(0.16, 0.035 + base * 0.24),
      jitterPx: base * (settings.jitter / 100) * 0.9 * motionScale * dyslexiaScale,
      edgePx: base * (settings.edgeInstability / 100) * 1.2 * motionScale,
      chromaPx: settings.subpixelChromaDrift ? 0.35 + base * 0.95 * (1 + temporalPhase * 0.18) : 0,
      frequencyAlpha: settings.compressionInterferencePatterns ? Math.min(0.10, 0.012 + base * (settings.frequencyDisruption / 100) * 0.22) : 0,
      temporalSeed: Math.sin(frame * 12.9898 + time * 0.001) * 43758.5453,
      temporalPhase
    };
  }

  class PerformanceManager {
    constructor() {
      this.samples = [];
      this.last = performance.now();
      this.droppedFrames = 0;
      this.qualityScale = 1;
      this.visibilityPaused = document.hidden;
      this.hasWebGl2Support = Boolean(document.createElement('canvas').getContext('webgl2'));
      this.onVisibilityChange = () => {
        this.visibilityPaused = document.hidden;
      };
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    dispose() {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }

    shouldRender(frame) {
      if (this.visibilityPaused) return false;
      if (this.qualityScale < 0.42) return frame % 3 === 0;
      if (this.qualityScale < 0.68) return frame % 2 === 0;
      return true;
    }

    sample(now, renderer, settings) {
      const delta = now - this.last;
      this.last = now;
      if (delta > 34) this.droppedFrames += 1;
      this.samples.push(delta);
      if (this.samples.length > 90) this.samples.shift();
      const avg = this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length || 16.7;
      if (avg > 42) this.qualityScale = Math.max(0.35, this.qualityScale - 0.14);
      else if (avg > 30) this.qualityScale = Math.max(0.5, this.qualityScale - 0.08);
      else if (avg < 20) this.qualityScale = Math.min(1, this.qualityScale + 0.04);

      const optionalModes = [
        settings.adaptiveTemporalPhaseShifting,
        settings.subpixelChromaDrift,
        settings.edgeReconstructionPoisoning,
        settings.compressionInterferencePatterns
      ].filter(Boolean).length;
      const effectScore = Math.min(100, settings.intensity * 0.5 + settings.jitter * 0.12 + settings.edgeInstability * 0.14 + settings.ocrDisruption * 0.13 + settings.frequencyDisruption * 0.11 + optionalModes * 4);

      return {
        fps: Math.max(1, Math.round(1000 / avg)),
        frameMs: Number(avg.toFixed(2)),
        droppedFrames: this.droppedFrames,
        recommendedMode: !this.hasWebGl2Support || avg > 28 ? 'canvas2d' : 'webgl',
        renderer,
        qualityScale: Number(this.qualityScale.toFixed(2)),
        perturbationStrength: Math.round(effectScore * this.qualityScale),
        ocrResistance: Math.min(96, Math.round(effectScore * 0.86 + this.qualityScale * 18))
      };
    }
  }

  class CanvasPerturbationRenderer {
    constructor(canvas) {
      this.kind = 'canvas2d';
      this.canvas = canvas;
      this.frame = 0;
      this.cssWidth = 0;
      this.cssHeight = 0;
      this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
      if (!this.ctx) throw new Error('Canvas 2D is unavailable');
    }

    resize(width, height) {
      this.cssWidth = width;
      this.cssHeight = height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.floor(width * dpr));
      this.canvas.height = Math.max(1, Math.floor(height * dpr));
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    render(settings, time, qualityScale) {
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
          this.ctx.fillRect(x + Math.sin(x * 0.031 + time * 0.0011) * config.edgePx, 0, 1, height);
        }
        this.ctx.fillStyle = `rgba(248,250,252,${config.alpha * 0.3})`;
        for (let y = -block; y < height + block; y += block) {
          this.ctx.fillRect(0, y + Math.cos(y * 0.027 + time * 0.0013) * config.edgePx, width, 1);
        }
      }

      if (settings.subpixelChromaDrift) {
        this.ctx.globalAlpha = config.alpha;
        this.ctx.fillStyle = 'rgba(94,234,212,.55)';
        this.ctx.fillRect(config.chromaPx, 0, width, height);
        this.ctx.fillStyle = 'rgba(129,140,248,.42)';
        this.ctx.fillRect(-config.chromaPx, 0, width, height);
        this.ctx.globalAlpha = 1;
      }
    }

    dispose() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  class WebGLPerturbationRenderer {
    constructor(canvas) {
      this.kind = 'webgl';
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
      if (!this.gl) throw new Error('WebGL2 is unavailable');
      this.program = this.createProgram(WebGLPerturbationRenderer.vertexShader, WebGLPerturbationRenderer.fragmentShader);
      this.vao = this.gl.createVertexArray();
      this.uniforms = Object.fromEntries(['uResolution', 'uTime', 'uIntensity', 'uJitter', 'uFrequency', 'uEdge', 'uQuality', 'uModes'].map((name) => [name, this.mustUniform(name)]));
    }

    resize(width, height) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.floor(width * dpr));
      this.canvas.height = Math.max(1, Math.floor(height * dpr));
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    render(settings, time, qualityScale) {
      const gl = this.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.program);
      gl.bindVertexArray(this.vao);
      gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.uniforms.uTime, time);
      gl.uniform1f(this.uniforms.uIntensity, (settings.lowEyeStrain ? settings.intensity * 0.7 : settings.intensity) * 0.01);
      gl.uniform1f(this.uniforms.uJitter, settings.reducedMotion ? settings.jitter * 0.0008 : settings.jitter * 0.004);
      gl.uniform1f(this.uniforms.uFrequency, settings.frequencyDisruption * 0.01);
      gl.uniform1f(this.uniforms.uEdge, settings.edgeInstability * 0.01);
      gl.uniform1f(this.uniforms.uQuality, qualityScale);
      gl.uniform4f(this.uniforms.uModes, settings.adaptiveTemporalPhaseShifting ? 1 : 0, settings.subpixelChromaDrift ? 1 : 0, settings.edgeReconstructionPoisoning ? 1 : 0, settings.compressionInterferencePatterns ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    }

    dispose() {
      this.gl.deleteVertexArray(this.vao);
      this.gl.deleteProgram(this.program);
    }

    createProgram(vertexSource, fragmentSource) {
      const gl = this.gl;
      const program = gl.createProgram();
      if (!program) throw new Error('Unable to allocate WebGL program');
      const vertex = this.compile(gl.VERTEX_SHADER, vertexSource);
      const fragment = this.compile(gl.FRAGMENT_SHADER, fragmentSource);
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'WebGL link failed');
      return program;
    }

    compile(type, source) {
      const shader = this.gl.createShader(type);
      if (!shader) throw new Error('Unable to allocate shader');
      this.gl.shaderSource(shader, source);
      this.gl.compileShader(shader);
      if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) throw new Error(this.gl.getShaderInfoLog(shader) || 'Shader compile failed');
      return shader;
    }

    mustUniform(name) {
      const uniform = this.gl.getUniformLocation(this.program, name);
      if (!uniform) throw new Error(`Missing uniform ${name}`);
      return uniform;
    }
  }

  WebGLPerturbationRenderer.vertexShader = `#version 300 es
const vec2 verts[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main(){ gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0); }`;

  WebGLPerturbationRenderer.fragmentShader = `#version 300 es
precision mediump float;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uTime;
uniform float uIntensity;
uniform float uJitter;
uniform float uFrequency;
uniform float uEdge;
uniform float uQuality;
uniform vec4 uModes;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float lineMask(float coord, float spacing, float width){ return 1.0 - smoothstep(0.0, width, abs(mod(coord, spacing) - width)); }
void main(){
  vec2 uv = gl_FragCoord.xy / max(uResolution.xy, vec2(1.0));
  float t = uTime * 0.001;
  float temporal = uModes.x * sin(t * 5.7 + uv.y * 17.0) * 0.5 + 0.5;
  float grain = hash(floor((gl_FragCoord.xy + temporal * 3.0) / 3.0) + floor(t * 17.0));
  float scan = sin((uv.y * uResolution.y * (0.58 + uFrequency * 0.34)) + t * 7.1);
  float compression = uModes.w * smoothstep(0.92, 1.0, abs(scan)) * (0.4 + grain * 0.6);
  float edgeX = uModes.z * lineMask(gl_FragCoord.x + sin(t + uv.y * 9.0) * uEdge * 3.0, 72.0 - uEdge * 34.0, 1.3);
  float edgeY = uModes.z * lineMask(gl_FragCoord.y + cos(t + uv.x * 8.0) * uEdge * 3.0, 68.0 - uEdge * 30.0, 1.2);
  vec3 chroma = mix(vec3(0.92, 0.98, 1.0), vec3(0.46 + temporal * 0.12, 0.92, 0.88), uModes.y);
  float alpha = min(0.12, 0.018 + uIntensity * uQuality * 0.12);
  alpha *= 0.42 + compression * uFrequency * 1.4 + (edgeX + edgeY) * uEdge * 0.45 + grain * uJitter * 0.28;
  outColor = vec4(chroma, alpha);
}`;

  class OptiShieldOverlay {
    constructor(settings, onStats) {
      this.settings = settings;
      this.onStats = onStats;
      this.frame = 0;
      this.animationId = 0;
      this.lastStatsPublishedAt = -Infinity;
      this.stats = { fps: 60, frameMs: 16.7, droppedFrames: 0, recommendedMode: 'canvas2d', renderer: 'auto', qualityScale: 1, perturbationStrength: settings.intensity, ocrResistance: 54 };
      this.manager = new PerformanceManager();
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'optishield-overlay';
      Object.assign(this.canvas.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2147483647', mixBlendMode: settings.highContrastCompatible ? 'normal' : 'overlay', opacity: '1', boxShadow: 'inset 0 0 0 1px rgba(94,234,212,.18)' });
      this.debugPanel = document.createElement('div');
      this.debugPanel.id = 'optishield-debug-panel';
      Object.assign(this.debugPanel.style, { position: 'fixed', right: '12px', bottom: '12px', zIndex: '2147483647', padding: '8px 10px', borderRadius: '10px', background: 'rgba(2,6,23,.82)', color: '#dbeafe', font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace', pointerEvents: 'none', boxShadow: '0 8px 28px rgba(0,0,0,.28)' });
      document.documentElement.append(this.canvas, this.debugPanel);
      this.renderer = this.createRenderer(settings.mode);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(document.documentElement);
      this.resize();
      this.syncDebugPanel();
    }

    start() {
      const tick = (now) => {
        this.frame += 1;
        if (this.settings.enabled && this.manager.shouldRender(this.frame)) {
          this.renderer.render(this.settings, now, this.manager.qualityScale);
          this.stats = this.manager.sample(now, this.renderer.kind, this.settings);
          this.syncDebugPanel();
          if (now - this.lastStatsPublishedAt >= 333) {
            this.lastStatsPublishedAt = now;
            this.onStats(this.stats);
          }
        }
        this.animationId = requestAnimationFrame(tick);
      };
      this.animationId = requestAnimationFrame(tick);
    }

    update(settings) {
      const previousMode = this.settings.mode;
      this.settings = settings;
      this.canvas.style.mixBlendMode = settings.highContrastCompatible ? 'normal' : 'overlay';
      if (previousMode !== settings.mode || (settings.mode === 'auto' && this.stats.recommendedMode !== this.renderer.kind)) {
        this.renderer.dispose();
        this.renderer = this.createRenderer(settings.mode === 'auto' ? this.stats.recommendedMode : settings.mode);
        this.resize();
      }
      this.syncDebugPanel();
    }

    dispose() {
      cancelAnimationFrame(this.animationId);
      this.resizeObserver.disconnect();
      this.manager.dispose();
      this.renderer.dispose();
      this.canvas.remove();
      this.debugPanel.remove();
    }

    resize() {
      this.renderer.resize(window.innerWidth, window.innerHeight);
    }

    syncDebugPanel() {
      this.debugPanel.hidden = !this.settings.debugPanel;
      if (!this.debugPanel.hidden) {
        this.debugPanel.textContent = `OptiShield | ${this.stats.renderer} | ${this.stats.fps} FPS | ${this.stats.frameMs} ms | quality ${Math.round(this.stats.qualityScale * 100)}% | strength ${this.stats.perturbationStrength}% | OCR resistance ${this.stats.ocrResistance}%`;
      }
    }

    createRenderer(mode) {
      if (mode !== 'canvas2d') {
        try {
          return new WebGLPerturbationRenderer(this.canvas);
        } catch (_error) {
          // Canvas fallback keeps protection active on Chromebooks, low-end devices, or disabled WebGL.
        }
      }
      return new CanvasPerturbationRenderer(this.canvas);
    }
  }

  let overlay;
  let currentSettings;
  let observer;

  function publishStats(stats) {
    chrome.runtime.sendMessage({ type: 'OPTISHIELD_STATS', stats }).catch(() => undefined);
  }

  async function apply(settings) {
    currentSettings = settings;
    if (!settings.enabled || isSiteDisabled(settings.disabledSites)) {
      overlay?.dispose();
      overlay = undefined;
      return;
    }
    if (!overlay) {
      overlay = new OptiShieldOverlay(settings, publishStats);
      overlay.start();
    } else {
      overlay.update(settings);
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'OPTISHIELD_SETTINGS_UPDATED') {
      apply(message.settings).then(() => sendResponse({ ok: true }));
      return true;
    }
    if (message.type === 'OPTISHIELD_GET_SETTINGS') {
      sendResponse({ ok: true, settings: currentSettings });
      return false;
    }
    return false;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]) {
      apply({ ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEY].newValue || {}) });
    }
  });

  observer = new MutationObserver(() => {
    if (overlay && !document.getElementById('optishield-overlay')) {
      overlay.dispose();
      overlay = undefined;
      getSettings().then(apply).catch(() => undefined);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  getSettings().then(apply).catch(() => undefined);
  window.addEventListener('pagehide', () => {
    observer?.disconnect();
    overlay?.dispose();
  });
})();
