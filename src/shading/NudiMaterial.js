import * as THREE from 'three';

// The nudibranch body material — the OPPOSITE thesis to the siphonophore gel: these
// animals are opaque, saturated, and wet, seen on a reef under real light. So this
// is a physical PBR surface with a strong clearcoat "mucus" glaze (the wet gleam),
// a subtle sheen for the velvety species, and (soon) a procedural pattern stack
// driven in body-UV via onBeforeCompile. Not additive, not glowing.
export function makeBodyMaterial(surface) {
  const s = surface;
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(s.base),
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: s.gloss ?? 0.7,
    clearcoatRoughness: 0.16,
    sheen: 0.3,
    sheenColor: new THREE.Color(s.base).offsetHSL(0, -0.2, 0.2),
    sheenRoughness: 0.6,
    side: THREE.DoubleSide,
  });

  // The pattern stack — procedural layers in body-UV (u along body, t around the
  // cross-section; t≈0 & t≈0.61 are the two mantle margins, t≈0.31 the dorsal
  // midline, t>0.62 the foot). This is nudibranch identity, so it's injected right
  // into the diffuse colour before lighting.
  const U = {
    uBase: { value: new THREE.Color(s.base) },
    uCountershade: { value: s.countershade ?? 0.15 },
    uMarginCol: { value: new THREE.Color(s.margin.color) },
    uMarginW: { value: s.margin.width },
    uMargin2Col: { value: new THREE.Color(s.margin.secondColor || '#ffffff') },
    uMargin2W: { value: s.margin.secondWidth || 0 },
    uSpotCol: { value: new THREE.Color(s.spots.color) },
    uSpotAmt: { value: s.spots.amount },
    uSpotScale: { value: s.spots.scale },
    uRetCol: { value: new THREE.Color(s.reticulation.color) },
    uRetAmt: { value: s.reticulation.amount },
    uRetScale: { value: s.reticulation.scale },
    uLineCol: { value: new THREE.Color(s.lines.color) },
    uLineAmt: { value: s.lines.amount },
    uLineCount: { value: s.lines.count },
  };
  mat.userData.patternUniforms = U;

  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPatUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPatUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', PATTERN_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = nudiPattern(vPatUv);');
  };
  return mat;
}

const PATTERN_GLSL = /* glsl */`
#include <common>
varying vec2 vPatUv;
uniform vec3 uBase, uMarginCol, uMargin2Col, uSpotCol, uRetCol, uLineCol;
uniform float uCountershade, uMarginW, uMargin2W, uSpotAmt, uSpotScale, uRetAmt, uRetScale, uLineAmt, uLineCount;

vec2 hash2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }

// Worley/cellular: returns F1 (nearest) and edge distance (F2-F1).
vec2 worley(vec2 p){
  vec2 n = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 g = vec2(float(i),float(j));
    vec2 o = hash2(n+g);
    vec2 r = g + o - f;
    float d = dot(r,r);
    if(d<f1){ f2=f1; f1=d; } else if(d<f2){ f2=d; }
  }
  return vec2(sqrt(f1), sqrt(f2)-sqrt(f1));
}

vec3 nudiPattern(vec2 uv){
  float u = uv.x, t = uv.y;
  vec3 c = uBase;
  bool top = t < 0.62;
  float dorsal = 1.0 - clamp(abs(t-0.31)/0.31, 0.0, 1.0); // 1 at dorsal midline

  // Countershade: dorsum a touch deeper, flanks a touch brighter.
  c *= 1.0 - uCountershade * (dorsal - 0.5) * 0.5;

  if (top) {
    // Spots (cellular): pigment blobs where Worley F1 is small.
    if (uSpotAmt > 0.001){
      float w = worley(uv * uSpotScale + 3.1).x;
      c = mix(c, uSpotCol, uSpotAmt * (1.0 - smoothstep(0.25, 0.55, w)));
    }
    // Reticulation: bright net along cell edges.
    if (uRetAmt > 0.001){
      float e = worley(uv * uRetScale + 7.7).y;
      c = mix(c, uRetCol, uRetAmt * (1.0 - smoothstep(0.0, 0.09, e)));
    }
    // Longitudinal lines: bands at fixed t running along the body.
    if (uLineAmt > 0.001){
      float ln = abs(fract((t - 0.31) * uLineCount + 0.5) - 0.5);
      c = mix(c, uLineCol, uLineAmt * (1.0 - smoothstep(0.0, 0.12, ln)));
    }
    // Mantle-margin band(s): contrasting rim at the two mantle edges.
    float edge = min(t, 0.61 - t);
    c = mix(c, uMarginCol, 1.0 - smoothstep(uMarginW * 0.7, uMarginW, edge));
    if (uMargin2W > 0.001)
      c = mix(c, uMargin2Col, 1.0 - smoothstep(uMargin2W * 0.6, uMargin2W, edge));
  } else {
    c = mix(uBase, vec3(0.7), 0.3); // pale foot sole
  }
  return c;
}
`;

// Appendage material — cerata / gills / rhinophores. Uses per-vertex colour (base →
// gut core → tip baked by the appendage generator) with a translucent, wet look so
// the coloured cores glow with light passing through them.
export function makeAppendageMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.3,
    metalness: 0.0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
    transmission: 0.35,
    thickness: 0.5,
    ior: 1.35,
    attenuationDistance: 0.6,
    sheen: 0.25,
    side: THREE.DoubleSide,
  });
  // Cerata / gills sway in the current: displace laterally, growing toward the tip
  // (higher above the body → more sway), with a travelling phase so the dorsum
  // shimmers instead of moving in unison.
  const U = { uTime: { value: 0 }, uSway: { value: 0.05 } };
  mat.userData.anim = U;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uSway;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float hgt = smoothstep(0.02, 0.28, transformed.y);
        float ph = uTime * 1.6 + transformed.x * 6.0 + transformed.z * 5.0;
        transformed.x += sin(ph) * uSway * hgt;
        transformed.z += cos(ph * 0.9) * uSway * hgt * 0.7;`);
  };
  return mat;
}

// Small emissive/translucent material for appendage tips + cores (added later).
export function makeTipMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color).multiplyScalar(0.15),
    roughness: 0.4,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });
}
