// Implements Volumetric Sun Shader: Differential Rotation and Limb Darkening

// Vertex Shader
export const sunVertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
}
`;

// Fragment Shader
export const sunFragmentShader = `
uniform float time;
uniform sampler2D noiseTexture;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
    // 1. Differential Rotation
    // Equator rotates faster than poles.
    // latitude roughly maps to vUv.y (0 to 1). Center is 0.5.
    float latitude = (vUv.y - 0.5) * 3.14159;
    float rotationSpeed = 1.0 - 0.3 * sin(latitude) * sin(latitude);
    
    // Shift UVs based on time and differential rotation speed
    vec2 rotUv = vec2(vUv.x + time * rotationSpeed * 0.05, vUv.y);
    
    // Sample a noise texture for plasma granulation (simulated by simple sin waves if texture not bound)
    float plasma = sin(rotUv.x * 50.0 + time) * cos(rotUv.y * 50.0) * 0.5 + 0.5;
    
    // Base Color (Yellow-Orange)
    vec3 baseColor = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 0.8, 0.1), plasma);
    
    // 2. Limb Darkening
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    
    // Calculate cosine of angle between normal and view direction
    float cosTheta = max(dot(normal, viewDir), 0.0);
    
    // Empirical limb darkening formula: I/I0 = 1 - u * (1 - cosTheta)
    float u = 0.6; // Limb darkening coefficient for the Sun in visible light
    float limbEffect = 1.0 - u * (1.0 - cosTheta);
    
    // Final output color
    vec3 finalColor = baseColor * limbEffect;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;
