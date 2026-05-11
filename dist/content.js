(() => {
  'use strict';

  const STORAGE_KEY = 'optishield.settings';
  const DEFAULT_SETTINGS = {
    enabled: true,
    mode: 'canvas2d',
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

  function styleScale(style) {
    if (style === 'linear') return 0.35;
    if (style === 'adaptive') return 0.78;
    if (style === 'cameraHardened') return 1;
    return 0.62;
  }

  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  function hash2(x, y) {
    return Math.sin(x * 127.1 + y * 311.7) * 43758.5453123 % 1;
  }

  function valueNoise2D(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = smoothstep(fx);
    const uy = smoothstep(fy);
    const a = hash2(ix, iy);
    const b = hash2(ix + 1, iy);
    const c = hash2(ix, iy + 1);
    const d = hash2(ix + 1, iy + 1);
    const x1 = a + (b - a) * ux;
    const x2 = c + (d - c) * ux;
    return x1 + (x2 - x1) * uy;
  }

  function layeredWarp(x, y, time, config) {
    if (config.warpPx <= 0) return 0;
    const drift = time * 0.00018 * config.warpSpeed;
    const large = valueNoise2D(x * config.warpDensity + drift, y * config.warpDensity * 0.72 - drift * 0.63);
    const micro = valueNoise2D(x * config.warpDensity * 5.1 - drift * 2.7, y * config.warpDensity * 4.3 + drift * 3.1);
    const curved = valueNoise2D((x + large * 9) * config.warpDensity * 1.7, (y + micro * 7) * config.warpDensity * 1.3 + drift);
    return ((large - 0.5) * 0.68 + (micro - 0.5) * 0.18 + (curved - 0.5) * 0.28 * config.warpCurvature) * config.warpPx;
  }

  function frameConfig(settings, frame, time, qualityScale) {
    const eyeStrainScale = settings.lowEyeStrain ? 0.68 : 1;
    const motionScale = settings.reducedMotion ? 0.22 : 1;
    const dyslexiaScale = settings.dyslexiaFriendly ? 0.55 : 1;
    const base = settings.intensity / 100 * eyeStrainScale * qualityScale;
    const temporalPhase = settings.adaptiveTemporalPhaseShifting ? Math.sin(frame * 0.73 + time * 0.0021) : 0;
    const warpStyleScale = styleScale(settings.distortionStyle);
    const warpPx = Math.min(3, settings.warpAmplitude / 100 * 3 * eyeStrainScale * motionScale * warpStyleScale * qualityScale);
    return {
      alpha: Math.min(0.16, 0.035 + base * 0.24),
      jitterPx: base * (settings.jitter / 100) * 0.9 * motionScale * dyslexiaScale,
      edgePx: base * (settings.edgeInstability / 100) * 1.2 * motionScale,
      chromaPx: settings.subpixelChromaDrift ? 0.35 + base * 0.95 * (1 + temporalPhase * 0.18) : 0,
      frequencyAlpha: settings.compressionInterferencePatterns ? Math.min(0.10, 0.012 + base * (settings.frequencyDisruption / 100) * 0.22) : 0,
      temporalSeed: Math.sin(frame * 12.9898 + time * 0.001) * 43758.5453,
      temporalPhase,
      warpPx,
      warpSpeed: (settings.reducedMotion ? 0.12 : 1) * (0.035 + settings.warpSpeed / 100),
      warpDensity: 0.0025 + settings.warpDensity / 100 * 0.014,
      warpCurvature: settings.warpCurvature / 100 * warpStyleScale
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
      this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true }) || canvas.getContext('2d', { alpha: true });
      if (!this.ctx) throw new Error('Canvas 2D is unavailable');
    }

    resize(width, height) {
      this.cssWidth = width;
      this.cssHeight = height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.floor(width * dpr));
      this.canvas.height = Math.max(1, Math.floor(height * dpr));
      this.canvas.style.setProperty('width', `${width}px`, 'important');
      this.canvas.style.setProperty('height', `${height}px`, 'important');
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
          const warp = layeredWarp(0, y, time, config);
          const offset = Math.sin(y * 0.073 + time * 0.0017 + config.temporalPhase) * config.jitterPx + warp;
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
        this.ctx.fillRect(config.chromaPx + layeredWarp(width * 0.33, height * 0.5, time, config) * 0.28, 0, width, height);
        this.ctx.fillStyle = 'rgba(129,140,248,.42)';
        this.ctx.fillRect(-config.chromaPx + layeredWarp(width * 0.66, height * 0.5, time + 1700, config) * 0.28, 0, width, height);
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
      this.canvas.style.setProperty('width', `${width}px`, 'important');
      this.canvas.style.setProperty('height', `${height}px`, 'important');
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    render(settings, time, qualityScale) {
      const gl = this.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (gl.isContextLost()) return;
      gl.useProgram(this.program);
      if (this.vao) gl.bindVertexArray(this.vao);
      gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.uniforms.uTime, time);
      gl.uniform1f(this.uniforms.uIntensity, (settings.lowEyeStrain ? settings.intensity * 0.82 : settings.intensity) * 0.014);
      gl.uniform1f(this.uniforms.uJitter, settings.reducedMotion ? settings.jitter * 0.0014 : settings.jitter * 0.0075);
      gl.uniform1f(this.uniforms.uFrequency, settings.frequencyDisruption * 0.014);
      gl.uniform1f(this.uniforms.uEdge, settings.edgeInstability * 0.014);
      gl.uniform1f(this.uniforms.uQuality, qualityScale);
      gl.uniform4f(this.uniforms.uModes, settings.adaptiveTemporalPhaseShifting ? 1 : 0, settings.subpixelChromaDrift ? 1 : 0, settings.edgeReconstructionPoisoning ? 1 : 0, settings.compressionInterferencePatterns ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (this.vao) gl.bindVertexArray(null);
    }

    dispose() {
      if (this.vao) this.gl.deleteVertexArray(this.vao);
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
float valueNoise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float lineMask(float coord, float spacing, float width){ return 1.0 - smoothstep(0.0, width, abs(mod(coord, spacing) - width)); }

void main(){
  vec2 uv = gl_FragCoord.xy / max(uResolution.xy, vec2(1.0));
  float t = uTime * 0.001;
  float slow = valueNoise(uv * vec2(5.0, 3.4) + vec2(t * 0.07, -t * 0.043));
  float micro = valueNoise(uv * vec2(29.0, 23.0) + vec2(-t * 0.31, t * 0.27));
  float curved = valueNoise(uv * vec2(11.0, 8.0) + vec2(slow * 0.45, micro * 0.32 + t * 0.055));
  float warp = ((slow - 0.5) * 1.55 + (micro - 0.5) * 0.46 + (curved - 0.5) * 0.58) * uJitter * uQuality;
  float temporal = uModes.x * (slow * 0.68 + micro * 0.32);
  float grain = hash(floor((gl_FragCoord.xy + temporal * 3.0) / 3.0) + floor(t * 17.0));
  float scan = sin(((uv.y + warp * 0.0055) * uResolution.y * (0.58 + uFrequency * 0.42)) + t * 7.1 + warp * 1.35);
  float compression = uModes.w * smoothstep(0.88, 1.0, abs(scan)) * (0.5 + grain * 0.7);
  float edgeX = uModes.z * lineMask(gl_FragCoord.x + warp * 3.6 + sin(t + uv.y * 9.0) * uEdge * 4.2, 72.0 - uEdge * 34.0, 1.65);
  float edgeY = uModes.z * lineMask(gl_FragCoord.y + warp * 2.8 + cos(t + uv.x * 8.0) * uEdge * 4.0, 68.0 - uEdge * 30.0, 1.55);
  float veil = 0.24 + slow * 0.10 + micro * 0.06;
  vec3 chroma = mix(vec3(0.78, 0.95, 1.0), vec3(0.38 + temporal * 0.18 + warp * 0.018, 0.95, 0.88 - warp * 0.012), uModes.y);
  float alpha = min(0.19, 0.035 + uIntensity * uQuality * 0.17);
  alpha *= veil + compression * uFrequency * 1.8 + (edgeX + edgeY) * uEdge * 0.62 + grain * uJitter * 0.34;
  outColor = vec4(chroma, alpha);
}`;

  class OptiShieldOverlay {
    constructor(settings, onStats) {
      this.settings = settings;
      this.onStats = onStats;
      this.frame = 0;
      this.animationId = 0;
      this.lastStatsPublishedAt = -Infinity;
      this.stats = { fps: 60, frameMs: 16.7, droppedFrames: 0, recommendedMode: 'canvas2d', renderer: 'canvas2d', qualityScale: 1, perturbationStrength: settings.intensity, ocrResistance: 54 };
      this.manager = new PerformanceManager();
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
      this.renderer = this.createRenderer(settings.mode);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(document.documentElement);
      this.resize();
      this.syncDebugPanel();
    }

    start() {
      const tick = (now) => {
        this.frame += 1;
        if (this.frame % 30 === 0) this.ensureTopmost();
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
      this.applyTopOverlayStyles();
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
      this.root.remove();
    }

    applyTopOverlayStyles() {
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

    applyDebugPanelStyles() {
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

    ensureTopmost() {
      if (this.root.parentElement !== document.documentElement) {
        document.documentElement.append(this.root);
      } else if (document.documentElement.lastElementChild !== this.root) {
        document.documentElement.append(this.root);
      }
    }

    resize() {
      this.renderer.resize(window.innerWidth, window.innerHeight);
    }

    syncDebugPanel() {
      this.applyDebugPanelStyles();
      this.debugPanel.hidden = !this.settings.debugPanel;
      if (!this.debugPanel.hidden) {
        this.debugPanel.textContent = `OptiShield | ${this.stats.renderer} | ${this.stats.fps} FPS | ${this.stats.frameMs} ms | quality ${Math.round(this.stats.qualityScale * 100)}% | strength ${this.stats.perturbationStrength}% | OCR resistance ${this.stats.ocrResistance}%`;
      }
    }

    createRenderer(mode) {
      if (mode === 'webgl') {
        try {
          return new WebGLPerturbationRenderer(this.canvas);
        } catch (_error) {
          this.replaceCanvasForCanvasFallback();
          // Canvas fallback keeps protection active on Chromebooks, low-end devices, or disabled WebGL.
        }
      }
      return new CanvasPerturbationRenderer(this.canvas);
    }

    replaceCanvasForCanvasFallback() {
      const replacement = document.createElement('canvas');
      replacement.id = this.canvas.id;
      this.canvas.replaceWith(replacement);
      this.canvas = replacement;
      this.shadow.prepend(this.canvas);
      this.applyTopOverlayStyles();
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
    if (overlay && !document.getElementById('optishield-root')) {
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
