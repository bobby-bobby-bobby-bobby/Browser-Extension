import{r as c,c as p,j as e,u as v,S as o}from"./styles-DMM0p9n7.js";import{D as b}from"./settings-store-D6X_sjeW.js";/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=t=>t.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),l=(...t)=>t.filter((a,n,i)=>!!a&&a.trim()!==""&&i.indexOf(a)===n).join(" ").trim();/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var y={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=c.forwardRef(({color:t="currentColor",size:a=24,strokeWidth:n=2,absoluteStrokeWidth:i,className:s="",children:r,iconNode:h,...u},m)=>c.createElement("svg",{ref:m,...y,width:a,height:a,stroke:t,strokeWidth:i?Number(n)*24/Number(a):n,className:l("lucide",s),...u},[...h.map(([x,j])=>c.createElement(x,j)),...Array.isArray(r)?r:[r]]));/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=(t,a)=>{const n=c.forwardRef(({className:i,...s},r)=>c.createElement(f,{ref:r,iconNode:a,className:l(`lucide-${g(t)}`,i),...s}));return n.displayName=`${t}`,n};/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=d("Activity",[["path",{d:"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",key:"169zse"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=d("ShieldCheck",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);function N(){const{settings:t,setSettings:a}=v(),[n,i]=c.useState(b);return c.useEffect(()=>{const s=r=>{r.type==="OPTISHIELD_STATS"&&r.stats&&i(r.stats)};return chrome.runtime.onMessage.addListener(s),()=>chrome.runtime.onMessage.removeListener(s)},[]),e.jsxs("main",{className:"app",children:[e.jsxs("header",{className:"header",children:[e.jsxs("div",{className:"brand",children:[e.jsx("h1",{children:"OptiShield"}),e.jsx("span",{children:"Optical Privacy for the Modern Web"})]}),e.jsx("button",{className:`toggle ${t.enabled?"":"off"}`,onClick:()=>void a({enabled:!t.enabled}),children:t.enabled?"On":"Off"})]}),e.jsxs("section",{className:"card stats","aria-label":"Performance stats",children:[e.jsxs("div",{className:"stat",children:[e.jsx("b",{children:n.fps}),e.jsx("span",{children:"FPS"})]}),e.jsxs("div",{className:"stat",children:[e.jsx("b",{children:n.frameMs}),e.jsx("span",{children:"ms/frame"})]}),e.jsxs("div",{className:"stat",children:[e.jsx("b",{children:n.renderer}),e.jsx("span",{children:"renderer"})]})]}),e.jsxs("section",{className:"card grid",children:[e.jsxs("label",{className:"control",children:[e.jsx("span",{children:"Rendering mode"}),e.jsxs("select",{value:t.mode,onChange:s=>void a({mode:s.target.value}),children:[e.jsx("option",{value:"auto",children:"Auto recommended"}),e.jsx("option",{value:"canvas2d",children:"Canvas 2D"}),e.jsx("option",{value:"webgl",children:"WebGL"})]})]}),e.jsx(o,{label:"Overall intensity",value:t.intensity,onChange:s=>void a({intensity:s}),help:"Higher values increase optical disruption but may become more visible."}),e.jsx(o,{label:"Subpixel jitter",value:t.jitter,onChange:s=>void a({jitter:s})}),e.jsx(o,{label:"Edge instability",value:t.edgeInstability,onChange:s=>void a({edgeInstability:s})}),e.jsx(o,{label:"OCR disruption",value:t.ocrDisruption,onChange:s=>void a({ocrDisruption:s})}),e.jsx(o,{label:"Frequency disruption",value:t.frequencyDisruption,onChange:s=>void a({frequencyDisruption:s})})]}),e.jsxs("section",{className:"card grid",children:[e.jsxs("label",{className:"check",children:[e.jsx("input",{type:"checkbox",checked:t.lowEyeStrain,onChange:s=>void a({lowEyeStrain:s.target.checked})})," Low eye strain"]}),e.jsxs("label",{className:"check",children:[e.jsx("input",{type:"checkbox",checked:t.reducedMotion,onChange:s=>void a({reducedMotion:s.target.checked})})," Reduced motion"]}),e.jsxs("label",{className:"check",children:[e.jsx("input",{type:"checkbox",checked:t.dyslexiaFriendly,onChange:s=>void a({dyslexiaFriendly:s.target.checked})})," Dyslexia-friendly tuning"]})]}),e.jsxs("p",{className:"footer",children:[e.jsx(C,{size:14})," Local-only settings. ",e.jsx(k,{size:14})," No telemetry, accounts, analytics, or remote code."]})]})}p(document.getElementById("root")).render(e.jsx(N,{}));
