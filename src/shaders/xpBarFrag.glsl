// XP Bar fragment shader
// Gradient fill with glow effects

uniform vec3 uColorStart;
uniform vec3 uColorEnd;
uniform float uProgress;
uniform float uTime;
uniform float uPulseIntensity;

varying float vProgress;

void main() {
  // Base color with gradient
  vec3 baseColor = mix(uColorStart, uColorEnd, uProgress);
  
  // Add pulse glow when near completion
  float pulse = 1.0;
  if (uProgress > 0.9) {
    pulse = 1.0 + sin(uTime * 4.0) * 0.1 * uPulseIntensity;
  }
  
  // Edge glow effect
  vec2 coord = gl_PointCoord;
  float edgeDist = min(min(coord.x, 1.0 - coord.x), min(coord.y, 1.0 - coord.y));
  float edgeGlow = 1.0 - smoothstep(0.0, 0.1, edgeDist);
  
  vec3 finalColor = baseColor * pulse;
  finalColor += vec3(0.5, 0.8, 1.0) * edgeGlow * 0.3;
  
  // Gradient overlay for depth
  float gradient = coord.y;
  finalColor = mix(finalColor, finalColor * 1.2, gradient * 0.2);
  
  // Alpha with slight transparency
  float alpha = 0.9 + edgeGlow * 0.1;
  
  gl_FragColor = vec4(finalColor, alpha);
}
