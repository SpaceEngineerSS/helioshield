// Implements IMF Vector Field visualization (Parker Spiral orientation)

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface IMFVectorFieldProps {
  solarWindSpeed: number; // km/s
  count?: number;
}

export const IMFVectorField: React.FC<IMFVectorFieldProps> = ({ solarWindSpeed, count = 1000 }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  // Arrow geometry to represent magnetic field vectors
  const geometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.0, 0.2, 1.0, 4, 1);
    geo.rotateX(Math.PI / 2); // Point along Z axis initially
    return geo;
  }, []);

  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6 });
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    
    const time = clock.getElapsedTime();
    const v_sw = Math.max(solarWindSpeed, 300); // km/s, avoid division by zero
    
    // Solar rotation rate (approx 27 days for one rotation at equator)
    // Omega = 2.7 * 10^-6 rad/s. Scaled for visualization.
    const omega = 2.7e-6 * 100000; // Visualization scaling factor
    
    for (let i = 0; i < count; i++) {
      // Procedurally distribute points in a disc/volume around the Sun-Earth line
      const r = 5 + (i % 50) * 1.5; // Distance from Sun
      const theta = ((i / 50) * Math.PI * 2) - time * 0.1; // Azimuthal angle, rotating slowly
      
      // Parker Spiral equations
      // B_r ~ 1/r^2 (simplified)
      // B_phi ~ - (Omega * r / V_sw) * B_r
      const b_r = 1.0;
      const b_phi = - (omega * r / v_sw) * b_r;
      
      // Calculate position
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const y = (Math.random() - 0.5) * 5.0; // Scatter vertically
      
      dummy.position.set(x, y, z);
      
      // Calculate orientation (atan2 of B_phi and B_r)
      const angle = Math.atan2(b_phi, b_r);
      
      dummy.rotation.set(0, -angle + theta, 0); // Align arrow to spiral
      
      // Scale based on r (field gets weaker further out)
      const scale = Math.max(0.2, 2.0 / Math.sqrt(r));
      dummy.scale.set(scale, scale, scale);
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      // Color coding: Blue (<400) to Red (>700)
      const t = THREE.MathUtils.clamp((v_sw - 400) / (700 - 400), 0, 1);
      color.lerpColors(new THREE.Color(0x0044ff), new THREE.Color(0xff0000), t);
      meshRef.current.setColorAt(i, color);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, count]} />
  );
};
