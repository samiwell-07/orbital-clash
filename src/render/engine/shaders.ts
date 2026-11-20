export const GRADE_DEFAULTS = {
  vignetteStrength: 0.28,
  vignetteOffset: 0.35,
  aberration: 0.0008,
  grain: 0.025,
  saturation: 1.08,
  contrast: 1.06,
} as const;

/** Colour grade, vignette, edge chromatic aberration, film grain and event colour flashes (runs in linear HDR). */
export const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null as unknown },
    uTime: { value: 0 },
    uVignette: { value: GRADE_DEFAULTS.vignetteStrength },
    uVignetteOffset: { value: GRADE_DEFAULTS.vignetteOffset },
    uAberration: { value: GRADE_DEFAULTS.aberration },
    uGrain: { value: GRADE_DEFAULTS.grain },
    uSaturation: { value: GRADE_DEFAULTS.saturation },
    uContrast: { value: GRADE_DEFAULTS.contrast },
    uShadowTint: { value: [0.02, 0.05, 0.1] as unknown },
    uFlashColor: { value: [1, 0.2, 0.2] as unknown },
    uFlash: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uVignetteOffset, uAberration, uGrain, uSaturation, uContrast, uFlash;
    uniform vec3 uShadowTint, uFlashColor;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * uAberration * 8.0;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col += uShadowTint * (1.0 - smoothstep(0.0, 0.3, luma)) * 0.5;
      col = mix(vec3(luma), col, uSaturation);
      col = max((col - 0.18) * uContrast + 0.18, 0.0);
      float v = smoothstep(uVignetteOffset, 0.85, length(c) * 1.2);
      col *= 1.0 - v * uVignette * 2.2;
      col += uFlashColor * uFlash * (0.04 + v * 0.9);
      col += (hash(vUv * 1000.0) - 0.5) * uGrain * (0.3 + luma);
      gl_FragColor = vec4(col, 1.0);
    }`,
};
