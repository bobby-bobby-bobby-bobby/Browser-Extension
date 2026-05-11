"use strict";
(() => {
  // src/renderer/perturbation-config.ts
  function frameConfig(settings, frame, time, qualityScale = 1) {
    const eyeStrainScale = settings.lowEyeStrain ? 0.68 : 1;
    const motionScale = settings.reducedMotion ? 0.22 : 1;
    const dyslexiaScale = settings.dyslexiaFriendly ? 0.55 : 1;
    const base = settings.intensity / 100 * eyeStrainScale * qualityScale;
    const temporalPhase = settings.adaptiveTemporalPhaseShifting ? Math.sin(frame * 0.73 + time * 21e-4) : 0;
    return {
      alpha: Math.min(0.16, 0.035 + base * 0.24),
      jitterPx: base * (settings.jitter / 100) * 0.9 * motionScale * dyslexiaScale,
      edgePx: base * (settings.edgeInstability / 100) * 1.2 * motionScale,
      chromaPx: settings.subpixelChromaDrift ? 0.35 + base * 0.95 * (1 + temporalPhase * 0.18) : 0,
      frequencyAlpha: settings.compressionInterferencePatterns ? Math.min(0.1, 0.012 + base * (settings.frequencyDisruption / 100) * 0.22) : 0,
      temporalSeed: Math.sin(frame * 12.9898 + time * 1e-3) * 43758.5453,
      temporalPhase,
      qualityScale
    };
  }

  // src/renderer/canvas/canvas-renderer.ts
  var CanvasPerturbationRenderer = class {
    constructor(canvas) {
      this.canvas = canvas;
      const context = canvas.getContext("2d", { alpha: true, desynchronized: true }) ?? canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("Canvas 2D is unavailable");
      this.ctx = context;
    }
    kind = "canvas2d";
    ctx;
    frame = 0;
    cssWidth = 0;
    cssHeight = 0;
    resize(width, height) {
      this.cssWidth = width;
      this.cssHeight = height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.floor(width * dpr));
      this.canvas.height = Math.max(1, Math.floor(height * dpr));
      this.canvas.style.setProperty("width", `${width}px`, "important");
      this.canvas.style.setProperty("height", `${height}px`, "important");
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    render(settings, time, qualityScale = 1) {
      const width = this.cssWidth;
      const height = this.cssHeight;
      if (width <= 0 || height <= 0) return;
      const config = frameConfig(settings, this.frame++, time, qualityScale);
      this.ctx.clearRect(0, 0, width, height);
      this.ctx.globalCompositeOperation = "source-over";
      if (settings.compressionInterferencePatterns) {
        const spacing = Math.max(9, 24 - settings.frequencyDisruption * 0.13);
        for (let y = Math.abs(config.temporalSeed) % spacing - spacing; y < height; y += spacing) {
          const offset = Math.sin(y * 0.073 + time * 17e-4 + config.temporalPhase) * config.jitterPx;
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
          const phase = Math.sin(x * 0.031 + time * 11e-4) * config.edgePx;
          this.ctx.fillRect(x + phase, 0, 1, height);
        }
        this.ctx.fillStyle = `rgba(248,250,252,${config.alpha * 0.3})`;
        for (let y = -block; y < height + block; y += block) {
          const phase = Math.cos(y * 0.027 + time * 13e-4) * config.edgePx;
          this.ctx.fillRect(0, y + phase, width, 1);
        }
      }
      if (settings.subpixelChromaDrift) {
        this.ctx.globalAlpha = config.alpha;
        this.ctx.fillStyle = "rgba(94,234,212,0.55)";
        this.ctx.fillRect(config.chromaPx, 0, width, height);
        this.ctx.fillStyle = "rgba(129,140,248,0.42)";
        this.ctx.fillRect(-config.chromaPx, 0, width, height);
        this.ctx.globalAlpha = 1;
      }
    }
    dispose() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  };

  // src/storage/defaults.ts
  var DEFAULT_SETTINGS = {
    enabled: true,
    mode: "canvas2d",
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
  var DEFAULT_STATS = {
    fps: 60,
    frameMs: 16.7,
    droppedFrames: 0,
    recommendedMode: "canvas2d",
    renderer: "canvas2d",
    qualityScale: 1,
    perturbationStrength: DEFAULT_SETTINGS.intensity,
    ocrResistance: 54
  };

  // src/renderer/performance-manager.ts
  var PerformanceManager = class _PerformanceManager {
    static cachedWebGl2Support;
    samples = [];
    last = performance.now();
    droppedFrames = 0;
    visibilityPaused = document.hidden;
    qualityScale = 1;
    hasWebGl2Support = _PerformanceManager.getWebGl2Support();
    handleVisibilityChange = () => {
      this.visibilityPaused = document.hidden;
    };
    constructor() {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }
    dispose() {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
    shouldRender(frame = 0) {
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
      this.qualityScale = this.nextQuality(avg);
      const effectScore = this.effectScore(settings);
      return {
        fps: Math.max(1, Math.round(1e3 / avg)),
        frameMs: Number(avg.toFixed(2)),
        droppedFrames: this.droppedFrames,
        recommendedMode: this.recommend(avg),
        renderer,
        qualityScale: Number(this.qualityScale.toFixed(2)),
        perturbationStrength: Math.round(effectScore * this.qualityScale),
        ocrResistance: Math.min(96, Math.round(effectScore * 0.86 + this.qualityScale * 18))
      };
    }
    currentQualityScale() {
      return this.qualityScale;
    }
    nextQuality(avgFrameMs) {
      if (avgFrameMs > 42) return Math.max(0.35, this.qualityScale - 0.14);
      if (avgFrameMs > 30) return Math.max(0.5, this.qualityScale - 0.08);
      if (avgFrameMs < 20) return Math.min(1, this.qualityScale + 0.04);
      return this.qualityScale;
    }
    effectScore(settings) {
      const optionalModes = [
        settings.adaptiveTemporalPhaseShifting,
        settings.subpixelChromaDrift,
        settings.edgeReconstructionPoisoning,
        settings.compressionInterferencePatterns
      ].filter(Boolean).length;
      return Math.min(100, settings.intensity * 0.5 + settings.jitter * 0.12 + settings.edgeInstability * 0.14 + settings.ocrDisruption * 0.13 + settings.frequencyDisruption * 0.11 + optionalModes * 4);
    }
    static getWebGl2Support() {
      if (_PerformanceManager.cachedWebGl2Support !== void 0) return _PerformanceManager.cachedWebGl2Support;
      _PerformanceManager.cachedWebGl2Support = Boolean(document.createElement("canvas").getContext("webgl2"));
      return _PerformanceManager.cachedWebGl2Support;
    }
    recommend(avgFrameMs) {
      if (!this.hasWebGl2Support) return "canvas2d";
      if (avgFrameMs > 28) return "canvas2d";
      return "webgl";
    }
    static defaultStats() {
      return DEFAULT_STATS;
    }
  };

  // src/renderer/shaders/perturbation.frag.ts
  var perturbationFragmentShader = `#version 300 es
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
  var passThroughVertexShader = `#version 300 es
const vec2 verts[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main(){ gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0); }`;

  // src/renderer/webgl/webgl-renderer.ts
  var WebGLPerturbationRenderer = class {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, powerPreference: "low-power", preserveDrawingBuffer: false });
      if (!gl) throw new Error("WebGL2 is unavailable");
      this.gl = gl;
      this.program = this.createProgram(passThroughVertexShader, perturbationFragmentShader);
      this.vao = gl.createVertexArray();
      this.uniforms = {
        uResolution: this.mustUniform("uResolution"),
        uTime: this.mustUniform("uTime"),
        uIntensity: this.mustUniform("uIntensity"),
        uJitter: this.mustUniform("uJitter"),
        uFrequency: this.mustUniform("uFrequency"),
        uEdge: this.mustUniform("uEdge"),
        uQuality: this.mustUniform("uQuality"),
        uModes: this.mustUniform("uModes")
      };
    }
    kind = "webgl";
    gl;
    program;
    vao;
    uniforms;
    resize(width, height) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.floor(width * dpr));
      this.canvas.height = Math.max(1, Math.floor(height * dpr));
      this.canvas.style.setProperty("width", `${width}px`, "important");
      this.canvas.style.setProperty("height", `${height}px`, "important");
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    render(settings, time, qualityScale = 1) {
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
      gl.uniform1f(this.uniforms.uIntensity, (settings.lowEyeStrain ? settings.intensity * 0.7 : settings.intensity) * 0.01);
      gl.uniform1f(this.uniforms.uJitter, settings.reducedMotion ? settings.jitter * 8e-4 : settings.jitter * 4e-3);
      gl.uniform1f(this.uniforms.uFrequency, settings.frequencyDisruption * 0.01);
      gl.uniform1f(this.uniforms.uEdge, settings.edgeInstability * 0.01);
      gl.uniform1f(this.uniforms.uQuality, qualityScale);
      gl.uniform4f(
        this.uniforms.uModes,
        settings.adaptiveTemporalPhaseShifting ? 1 : 0,
        settings.subpixelChromaDrift ? 1 : 0,
        settings.edgeReconstructionPoisoning ? 1 : 0,
        settings.compressionInterferencePatterns ? 1 : 0
      );
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
      if (!program) throw new Error("Unable to allocate WebGL program");
      const vertex = this.compile(gl.VERTEX_SHADER, vertexSource);
      const fragment = this.compile(gl.FRAGMENT_SHADER, fragmentSource);
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "WebGL link failed");
      return program;
    }
    compile(type, source) {
      const shader = this.gl.createShader(type);
      if (!shader) throw new Error("Unable to allocate shader");
      this.gl.shaderSource(shader, source);
      this.gl.compileShader(shader);
      if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) throw new Error(this.gl.getShaderInfoLog(shader) ?? "Shader compile failed");
      return shader;
    }
    mustUniform(name) {
      const uniform = this.gl.getUniformLocation(this.program, name);
      if (!uniform) throw new Error(`Missing uniform ${name}`);
      return uniform;
    }
  };

  // src/renderer/overlay.ts
  var STATS_PUBLISH_HZ = 3;
  var STATS_PUBLISH_INTERVAL_MS = Math.floor(1e3 / STATS_PUBLISH_HZ);
  var OptiShieldOverlay = class {
    constructor(settings, onStats) {
      this.settings = settings;
      this.onStats = onStats;
      this.root = document.createElement("optishield-root");
      this.root.id = "optishield-root";
      this.shadow = this.root.attachShadow({ mode: "open" });
      this.canvas = document.createElement("canvas");
      this.canvas.id = "optishield-overlay";
      this.debugPanel = document.createElement("div");
      this.debugPanel.id = "optishield-debug-panel";
      this.shadow.append(this.canvas, this.debugPanel);
      this.applyTopOverlayStyles();
      document.documentElement.append(this.root);
      this.renderer = this.createRenderer(settings.mode);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(document.documentElement);
      this.resize();
      this.syncDebugPanel();
    }
    root;
    shadow;
    canvas;
    renderer;
    animationId = 0;
    stats = PerformanceManager.defaultStats();
    manager = new PerformanceManager();
    frame = 0;
    lastStatsPublishedAt = -Infinity;
    resizeObserver;
    debugPanel;
    start() {
      const tick = (now) => {
        this.frame += 1;
        if (this.frame % 30 === 0) this.ensureTopmost();
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
    update(settings) {
      const previousMode = this.settings.mode;
      this.settings = settings;
      this.applyTopOverlayStyles();
      if (previousMode !== settings.mode || settings.mode === "auto" && this.stats.recommendedMode !== this.renderer.kind) {
        this.renderer.dispose();
        this.renderer = this.createRenderer(settings.mode === "auto" ? this.stats.recommendedMode : settings.mode);
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
      rootStyle.setProperty("all", "initial", "important");
      rootStyle.setProperty("position", "fixed", "important");
      rootStyle.setProperty("inset", "0", "important");
      rootStyle.setProperty("width", "100vw", "important");
      rootStyle.setProperty("height", "100vh", "important");
      rootStyle.setProperty("pointer-events", "none", "important");
      rootStyle.setProperty("z-index", "2147483647", "important");
      rootStyle.setProperty("display", "block", "important");
      rootStyle.setProperty("visibility", "visible", "important");
      rootStyle.setProperty("opacity", "1", "important");
      rootStyle.setProperty("contain", "strict", "important");
      rootStyle.setProperty("isolation", "isolate", "important");
      const canvasStyle = this.canvas.style;
      canvasStyle.setProperty("all", "initial", "important");
      canvasStyle.setProperty("position", "fixed", "important");
      canvasStyle.setProperty("inset", "0", "important");
      canvasStyle.setProperty("width", "100vw", "important");
      canvasStyle.setProperty("height", "100vh", "important");
      canvasStyle.setProperty("pointer-events", "none", "important");
      canvasStyle.setProperty("z-index", "2147483647", "important");
      canvasStyle.setProperty("display", "block", "important");
      canvasStyle.setProperty("visibility", "visible", "important");
      canvasStyle.setProperty("opacity", "1", "important");
      canvasStyle.setProperty("mix-blend-mode", this.settings.highContrastCompatible ? "normal" : "overlay", "important");
      canvasStyle.setProperty("box-shadow", "inset 0 0 0 1px rgba(94,234,212,.18)", "important");
      canvasStyle.setProperty("contain", "strict", "important");
    }
    applyDebugPanelStyles() {
      const style = this.debugPanel.style;
      style.setProperty("all", "initial", "important");
      style.setProperty("position", "fixed", "important");
      style.setProperty("right", "12px", "important");
      style.setProperty("bottom", "12px", "important");
      style.setProperty("z-index", "2147483647", "important");
      style.setProperty("padding", "8px 10px", "important");
      style.setProperty("border-radius", "10px", "important");
      style.setProperty("background", "rgba(2,6,23,.82)", "important");
      style.setProperty("color", "#dbeafe", "important");
      style.setProperty("font", "12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace", "important");
      style.setProperty("pointer-events", "none", "important");
      style.setProperty("box-shadow", "0 8px 28px rgba(0,0,0,.28)", "important");
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
      if (this.debugPanel.hidden) return;
      this.debugPanel.textContent = `OptiShield | ${this.stats.renderer} | ${this.stats.fps} FPS | ${this.stats.frameMs} ms | quality ${Math.round(this.stats.qualityScale * 100)}% | strength ${this.stats.perturbationStrength}% | OCR resistance ${this.stats.ocrResistance}%`;
    }
    createRenderer(mode) {
      if (mode === "webgl") {
        try {
          return new WebGLPerturbationRenderer(this.canvas);
        } catch {
          this.replaceCanvasForCanvasFallback();
        }
      }
      return new CanvasPerturbationRenderer(this.canvas);
    }
    replaceCanvasForCanvasFallback() {
      const replacement = document.createElement("canvas");
      replacement.id = this.canvas.id;
      this.canvas.replaceWith(replacement);
      this.canvas = replacement;
      this.shadow.prepend(this.canvas);
      this.applyTopOverlayStyles();
    }
  };

  // src/storage/settings-store.ts
  var KEY = "optishield.settings";
  var SettingsStore = class {
    listeners = /* @__PURE__ */ new Set();
    async get() {
      const result = await chrome.storage.local.get(KEY);
      return { ...DEFAULT_SETTINGS, ...result[KEY] ?? {} };
    }
    async set(next) {
      const merged = { ...await this.get(), ...next };
      await chrome.storage.local.set({ [KEY]: merged });
      return merged;
    }
    subscribe(listener) {
      this.listeners.add(listener);
      const storageListener = (changes, area) => {
        if (area === "local" && KEY in changes) {
          listener({ ...DEFAULT_SETTINGS, ...changes[KEY].newValue ?? {} });
        }
      };
      chrome.storage.onChanged.addListener(storageListener);
      return () => {
        this.listeners.delete(listener);
        chrome.storage.onChanged.removeListener(storageListener);
      };
    }
    emit(settings) {
      this.listeners.forEach((listener) => listener(settings));
    }
  };
  var settingsStore = new SettingsStore();

  // src/utils/site.ts
  function normalizedHost(locationLike = window.location) {
    return locationLike.hostname.replace(/^www\./, "").toLowerCase();
  }
  function isSiteDisabled(disabledSites, host = normalizedHost()) {
    return disabledSites.some((site) => host === site || host.endsWith(`.${site}`));
  }

  // src/content/content.ts
  var overlay;
  var observer;
  var currentSettings;
  async function publishStats(stats) {
    await chrome.runtime.sendMessage({ type: "OPTISHIELD_STATS", stats }).catch(() => void 0);
  }
  async function apply(settings) {
    currentSettings = settings;
    const active = settings.enabled && !isSiteDisabled(settings.disabledSites);
    if (!active) {
      overlay?.dispose();
      overlay = void 0;
      return;
    }
    if (!overlay) {
      overlay = new OptiShieldOverlay(settings, (stats) => void publishStats(stats));
      overlay.start();
    } else {
      overlay.update(settings);
    }
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "OPTISHIELD_SETTINGS_UPDATED") {
      void apply(message.settings).then(() => sendResponse({ ok: true }));
      return true;
    }
    if (message.type === "OPTISHIELD_GET_SETTINGS") {
      sendResponse({ ok: true, settings: currentSettings });
      return false;
    }
    return false;
  });
  settingsStore.get().then(apply).catch(() => void 0);
  settingsStore.subscribe((settings) => void apply(settings));
  observer = new MutationObserver(() => {
    if (overlay && !document.getElementById("optishield-root")) {
      overlay.dispose();
      overlay = void 0;
      void settingsStore.get().then(apply);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("pagehide", () => {
    observer?.disconnect();
    overlay?.dispose();
  });
})();
