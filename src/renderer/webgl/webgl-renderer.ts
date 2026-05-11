import type { PerturbationSettings } from '../../types/settings';
import { passThroughVertexShader, perturbationFragmentShader } from '../shaders/perturbation.frag';

export class WebGLPerturbationRenderer {
  readonly kind = 'webgl' as const;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject | null;
  private uniforms: Record<string, WebGLUniformLocation>;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is unavailable');
    this.gl = gl;
    this.program = this.createProgram(passThroughVertexShader, perturbationFragmentShader);
    this.vao = gl.createVertexArray();
    this.uniforms = {
      uResolution: this.mustUniform('uResolution'),
      uTime: this.mustUniform('uTime'),
      uIntensity: this.mustUniform('uIntensity'),
      uJitter: this.mustUniform('uJitter'),
      uFrequency: this.mustUniform('uFrequency'),
      uEdge: this.mustUniform('uEdge'),
      uQuality: this.mustUniform('uQuality'),
      uModes: this.mustUniform('uModes')
    };
  }

  resize(width: number, height: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  render(settings: PerturbationSettings, time: number, qualityScale = 1): void {
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
    gl.uniform1f(this.uniforms.uJitter, settings.reducedMotion ? settings.jitter * 0.0008 : settings.jitter * 0.004);
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

  dispose(): void {
    if (this.vao) this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
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
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'WebGL link failed');
    return program;
  }

  private compile(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error('Unable to allocate shader');
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) throw new Error(this.gl.getShaderInfoLog(shader) ?? 'Shader compile failed');
    return shader;
  }

  private mustUniform(name: string): WebGLUniformLocation {
    const uniform = this.gl.getUniformLocation(this.program, name);
    if (!uniform) throw new Error(`Missing uniform ${name}`);
    return uniform;
  }
}
