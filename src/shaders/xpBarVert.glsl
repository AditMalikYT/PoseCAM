// XP Bar vertex shader
// Simple pass-through with potential for animated effects

uniform float uProgress;
uniform float uTime;
uniform vec2 uOffset;

attribute vec3 aPosition;

varying float vProgress;

void main() {
  vProgress = uProgress;
  
  vec3 newPosition = aPosition;
  
  // Add subtle pulse effect at full
  if (uProgress > 0.95) {
    float pulse = sin(uTime * 5.0) * 0.02 + 1.0;
    newPosition.x *= pulse;
  }
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
