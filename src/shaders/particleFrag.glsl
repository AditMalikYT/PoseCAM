// Particle fragment shader with procedural radial glow and birth flash
uniform vec3 uColor;
uniform float uGlowIntensity;

varying float vAlpha;
varying float vLifeRatio;

void main() {
  float dist = distance(gl_PointCoord, vec2(0.5));
  if (dist > 0.5) discard;
  
  float glow = 1.0 - smoothstep(0.0, 0.5, dist);
  vec3 finalColor = mix(uColor, uColor * 2.0, glow * uGlowIntensity);
  
  // Bright flash effect upon spawning
  float birthFlash = exp(-vLifeRatio * 8.0);
  finalColor += vec3(1.0, 0.9, 0.6) * birthFlash * 0.6;
  
  gl_FragColor = vec4(finalColor, glow * vAlpha);
}
