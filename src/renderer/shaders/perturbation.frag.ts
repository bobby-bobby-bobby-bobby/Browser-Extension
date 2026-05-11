export const perturbationFragmentShader = `#version 300 es
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
  float warp = ((slow - 0.5) * 1.35 + (micro - 0.5) * 0.32 + (curved - 0.5) * 0.42) * uJitter * uQuality;
  float temporal = uModes.x * (slow * 0.68 + micro * 0.32);
  float grain = hash(floor((gl_FragCoord.xy + temporal * 3.0) / 3.0) + floor(t * 17.0));
  float scan = sin(((uv.y + warp * 0.004) * uResolution.y * (0.58 + uFrequency * 0.34)) + t * 7.1 + warp);
  float compression = uModes.w * smoothstep(0.92, 1.0, abs(scan)) * (0.4 + grain * 0.6);
  float edgeX = uModes.z * lineMask(gl_FragCoord.x + warp * 2.6 + sin(t + uv.y * 9.0) * uEdge * 3.0, 72.0 - uEdge * 34.0, 1.3);
  float edgeY = uModes.z * lineMask(gl_FragCoord.y + warp * 1.9 + cos(t + uv.x * 8.0) * uEdge * 3.0, 68.0 - uEdge * 30.0, 1.2);
  vec3 chroma = mix(vec3(0.92, 0.98, 1.0), vec3(0.46 + temporal * 0.12 + warp * 0.012, 0.92, 0.88 - warp * 0.009), uModes.y);
  float alpha = min(0.12, 0.018 + uIntensity * uQuality * 0.12);
  alpha *= 0.42 + compression * uFrequency * 1.4 + (edgeX + edgeY) * uEdge * 0.45 + grain * uJitter * 0.28;
  outColor = vec4(chroma, alpha);
}`;

export const passThroughVertexShader = `#version 300 es
const vec2 verts[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main(){ gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0); }`;
