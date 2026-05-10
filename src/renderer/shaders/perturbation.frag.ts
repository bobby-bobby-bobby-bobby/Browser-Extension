export const perturbationFragmentShader = `#version 300 es
precision mediump float;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uTime;
uniform float uIntensity;
uniform float uJitter;
uniform float uFrequency;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

void main(){
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float scan = sin((uv.y * uResolution.y * 0.75) + uTime * 0.0017);
  float grain = hash(floor(gl_FragCoord.xy / 3.0) + floor(uTime * 0.018));
  float edgePulse = smoothstep(0.94, 1.0, abs(scan));
  float alpha = min(0.16, uIntensity * 0.0018);
  vec3 tint = vec3(0.36 + grain * 0.12, 0.83, 0.86);
  outColor = vec4(tint, alpha * (edgePulse * uFrequency + grain * uJitter));
}`;

export const passThroughVertexShader = `#version 300 es
const vec2 verts[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main(){ gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0); }`;
