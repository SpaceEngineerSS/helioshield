// Implements Procedural Magnetopause Geometry based on Shue et al. (1998)

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface MagnetopauseProps {
  dynamicPressure: number; // nPa
  bz: number; // IMF Bz component (nT)
}

export const MagnetopauseGeometry: React.FC<MagnetopauseProps> = ({ dynamicPressure, bz }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Create a base sphere geometry with high segment count for smooth deformation
  const baseGeometry = useMemo(() => {
    // 64x64 segments for high-fidelity deformation
    return new THREE.SphereGeometry(1, 64, 64);
  }, []);

  // Material with custom vertex shader for Shue et al. deformation
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        r0: { value: 10.0 }, // Standoff distance (Earth radii)
        alpha: { value: 0.5 }, // Flaring angle parameter
        color: { value: new THREE.Color(0x0088ff) }
      },
      vertexShader: `
        uniform float r0;
        uniform float alpha;
        
        varying vec3 vNormal;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          
          // Shue et al. (1998) deformation model
          // r = r0 * (2 / (1 + cos(theta)))^alpha
          // where theta is the angle from the Sun-Earth line (x-axis in GSE)
          
          // Assuming position is a unit sphere centered at origin
          // theta is the angle from the positive Z axis (if Z points to Sun)
          // For standard three.js, let's map Z to sunward direction.
          vec3 p = position;
          
          // Calculate theta (angle with +Z)
          float cosTheta = p.z; // since p is normalized
          // Avoid division by zero when cosTheta is -1 (tail)
          float denom = 1.0 + cosTheta;
          denom = max(denom, 0.01); 
          
          float r = r0 * pow(2.0 / denom, alpha);
          
          // Apply deformation, pushing vertices outwards
          // In tail direction (Z < 0), r becomes large. Cap it for visualization.
          r = min(r, 50.0);
          
          vec3 deformedPos = p * r;
          
          vec4 mvPosition = modelViewMatrix * vec4(deformedPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying vec3 vNormal;
        
        void main() {
          // Simple rim lighting
          vec3 viewDir = vec3(0.0, 0.0, 1.0);
          float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
          rim = smoothstep(0.6, 1.0, rim);
          
          // Add some transparency to the magnetopause
          gl_FragColor = vec4(color * (0.3 + rim * 0.7), 0.4);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }, []);

  useFrame(() => {
    if (material) {
      // Calculate Shue parameters dynamically based on solar wind
      // r0 = (10.22 + 1.29 * tanh(0.184 * (Bz + 8.14))) * Dp^(-1/6)
      const bzTerm = Math.tanh(0.184 * (bz + 8.14));
      const dpTerm = Math.pow(Math.max(dynamicPressure, 0.1), -1.0 / 6.0);
      const r0 = (10.22 + 1.29 * bzTerm) * dpTerm;
      
      // alpha = (0.58 - 0.007 * Bz) * (1 + 0.024 * log(Dp))
      const alpha = (0.58 - 0.007 * bz) * (1.0 + 0.024 * Math.log(Math.max(dynamicPressure, 0.1)));
      
      material.uniforms.r0.value = r0;
      material.uniforms.alpha.value = Math.max(alpha, 0.1); // Prevent degenerate alpha
    }
  });

  return (
    <mesh ref={meshRef} geometry={baseGeometry} material={material} />
  );
};
