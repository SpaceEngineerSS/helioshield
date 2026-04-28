// Implements Aurora Oval Shader (Additive Blend) based on Starkov Model

export const auroraVertexShader = `
uniform float time;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const auroraFragmentShader = `
uniform float time;
uniform float kpIndex;
uniform vec3 auroraColor;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

// Simple 3D noise for aurora dynamics
float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = i.x + i.y * 57.0 + 113.0 * i.z;
    return mix(
        mix(mix(fract(sin(n)*43758.5453), fract(sin(n+1.0)*43758.5453), f.x),
            mix(fract(sin(n+57.0)*43758.5453), fract(sin(n+58.0)*43758.5453), f.x), f.y),
        mix(mix(fract(sin(n+113.0)*43758.5453), fract(sin(n+114.0)*43758.5453), f.x),
            mix(fract(sin(n+170.0)*43758.5453), fract(sin(n+171.0)*43758.5453), f.x), f.y), f.z);
}

void main() {
  // Normalize position to get latitude
  vec3 p = normalize(vPosition);
  
  // Latitude angle from north pole (0 to PI)
  float colatitude = acos(p.y); // radians
  
  // Convert colatitude to degrees from equator (latitude)
  float lat = 90.0 - (colatitude * 180.0 / 3.14159);
  
  // Symmetry for southern hemisphere
  float absLat = abs(lat);
  
  // Starkov Model (Simplified for Shader)
  // Equatorward boundary expands with Kp
  float theta_e = 75.0 - 1.5 * kpIndex;
  // Poleward boundary
  float theta_p = 80.0 - 0.5 * kpIndex;
  
  // Determine if current latitude is within the aurora oval
  // We use smoothstep for soft edges
  float intensity = 0.0;
  
  if (absLat > (theta_e - 5.0) && absLat < (theta_p + 5.0)) {
      // Gaussian-like curve centered between theta_e and theta_p
      float center = (theta_e + theta_p) / 2.0;
      float width = (theta_p - theta_e) / 2.0;
      float dist = abs(absLat - center);
      intensity = exp(-(dist * dist) / (width * width));
  }
  
  // Add procedural noise for auroral curtains
  vec3 noisePos = vPosition * 5.0 + vec3(time * 0.1, 0.0, time * 0.2);
  float n = noise(noisePos) * 0.5 + 0.5;
  
  // Modulate intensity by noise and Kp
  intensity *= n * min(1.0, kpIndex / 5.0);
  
  // Nightside enhancement (aurora is stronger on the night side)
  // Assuming sun is at +Z
  float nightside = smoothstep(0.0, -1.0, p.z);
  intensity *= mix(0.3, 1.0, nightside); // Still slightly visible on dayside
  
  gl_FragColor = vec4(auroraColor * intensity, intensity * 0.8);
}
`;
