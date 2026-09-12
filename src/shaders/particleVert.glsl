// Particle vertex shader with lifetime attenuation and point scaling
uniform float uTime;
uniform float uSize;
uniform float uLifetime;
uniform float uAge;

attribute vec3 aVelocity;
attribute float aLifetime;
attribute float aSize;

varying float vAlpha;
varying float vLifeRatio;

void main() {
  vLifeRatio = clamp(uAge / uLifetime, 0.0, 1.0);
  vAlpha = 1.0 - smoothstep(0.6, 1.0, vLifeRatio);
  
  vec3 newPosition = position + aVelocity * uAge;
  newPosition.y -= 0.3 * uAge * uAge; // Subtle gravity curve
  
  vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
  float pSize = aSize > 0.0 ? aSize : 1.0;
  gl_PointSize = pSize * uSize * (300.0 / max(0.1, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;
}
