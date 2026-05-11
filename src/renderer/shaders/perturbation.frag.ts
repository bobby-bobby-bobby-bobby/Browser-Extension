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

export const passThroughVertexShader = `#version 300 es
const vec2 verts[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main(){ gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0); }`;
