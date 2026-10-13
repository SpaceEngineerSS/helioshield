import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Snapshot } from '../../state/derive';
import type { Magnetopause } from '../../model/magnetopause';
import { EARTH_R, EARTH_X, L1_X, RE, SUN_R, SUN_X, auToX, cmeDirection } from './layout';
import { TIERS, type Tier } from './quality';

export interface SceneColors {
  bg: string;
  text: string;
  text3: string;
  rule: string;
  sun: string;
  north: string;
  south: string;
  model: string;
}

export interface LabelRefs {
  sun: HTMLElement | null;
  l1: HTMLElement | null;
  earth: HTMLElement | null;
  mp: HTMLElement | null;
}

interface Props {
  snapshot: Snapshot;
  tier: Tier;
  colors: SceneColors;
  animate: boolean;
  labels: React.RefObject<LabelRefs>;
  onSlow: () => void;
}

const DEFAULT_MP: Magnetopause = { r0: 10, alpha: 0.58 };

// ─── Frame pacing ────────────────────────────────────────────────────────────

/**
 * Renders on demand. While animating, asks for frames at the tier's rate.
 * When frames come in too slowly it reports once, so "auto" quality can step down.
 */
function Pacer({ animate, fps, onSlow }: { animate: boolean; fps: number; onSlow: () => void }) {
  const invalidate = useThree((s) => s.invalidate);
  const slowRef = useRef(onSlow);
  slowRef.current = onSlow;

  useEffect(() => {
    if (!animate) {
      invalidate();
      return;
    }
    let raf = 0;
    let last = 0;
    let slowFrames = 0;
    let reported = false;
    const budget = 1000 / fps;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = now - last;
      if (dt < budget - 2) return;
      // Sustained frame times well over budget: the device cannot keep up.
      if (last && dt > budget * 1.8) slowFrames++;
      else slowFrames = Math.max(0, slowFrames - 1);
      if (!reported && slowFrames > 45) {
        reported = true;
        slowRef.current();
      }
      last = now;
      invalidate();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate, fps, invalidate]);
  return null;
}

function Controls() {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const c = new OrbitControls(camera, dom);
    c.enablePan = false;
    c.enableDamping = false;
    c.minDistance = 8;
    c.maxDistance = 22;
    c.minPolarAngle = Math.PI * 0.12;
    c.maxPolarAngle = Math.PI * 0.62;
    c.target.set(0, 0, 0);
    const onChange = () => invalidate();
    c.addEventListener('change', onChange);
    return () => {
      c.removeEventListener('change', onChange);
      c.dispose();
    };
  }, [camera, dom, invalidate]);
  return null;
}

// ─── Sun ─────────────────────────────────────────────────────────────────────

const sunVert = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vP = position;
  gl_Position = projectionMatrix * mv;
}`;

// Limb darkening I(mu) = 1 - u(1 - mu), with an optional cheap granulation pattern.
const sunFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uGran;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  float mu = clamp(dot(vN, vV), 0.0, 1.0);
  float limb = 1.0 - 0.62 * (1.0 - mu);
  float g = uGran > 0.5 ? 0.88 + 0.12 * noise(vP * 9.0 + vec3(0.0, uTime * 0.15, 0.0)) : 1.0;
  vec3 c = mix(uColor * 0.55, uColor * 1.15, limb) * g;
  gl_FragColor = vec4(c * limb, 1.0);
}`;

function coronaTexture(color: string): THREE.Texture {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.18, s / 2, s / 2, s / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.35, `${color}55`);
  g.addColorStop(1, `${color}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Sun({ color, granulation, animate }: { color: string; granulation: boolean; animate: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: sunVert,
        fragmentShader: sunFrag,
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uTime: { value: 0 },
          uGran: { value: granulation ? 1 : 0 },
        },
      }),
    [color, granulation],
  );
  const corona = useMemo(() => coronaTexture(color.length === 7 ? color : '#e8a33d'), [color]);
  useEffect(() => () => (mat.dispose(), corona.dispose()), [mat, corona]);
  useFrame((_, dt) => {
    if (animate) mat.uniforms.uTime.value += dt;
  });
  return (
    <group position={[SUN_X, 0, 0]}>
      <mesh material={mat}>
        <sphereGeometry args={[SUN_R, 48, 32]} />
      </mesh>
      <sprite scale={[SUN_R * 5, SUN_R * 5, 1]}>
        <spriteMaterial map={corona} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.55} />
      </sprite>
    </group>
  );
}

// ─── Earth ───────────────────────────────────────────────────────────────────

const earthFrag = /* glsl */ `
uniform vec3 uDay;
uniform vec3 uNight;
uniform vec3 uSunDir;
varying vec3 vWN;
void main() {
  float l = smoothstep(-0.15, 0.35, dot(normalize(vWN), uSunDir));
  gl_FragColor = vec4(mix(uNight, uDay, l), 1.0);
}`;
const earthVert = /* glsl */ `
varying vec3 vWN;
void main() {
  vWN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

function graticule(radius: number): THREE.BufferGeometry {
  const pts: number[] = [];
  const seg = 48;
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = radius * Math.sin((lat * Math.PI) / 180);
    const r = radius * Math.cos((lat * Math.PI) / 180);
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const b = ((i + 1) / seg) * Math.PI * 2;
      pts.push(r * Math.cos(a), y, r * Math.sin(a), r * Math.cos(b), y, r * Math.sin(b));
    }
  }
  for (let lon = 0; lon < 180; lon += 30) {
    const lo = (lon * Math.PI) / 180;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const b = ((i + 1) / seg) * Math.PI * 2;
      pts.push(
        radius * Math.cos(a) * Math.cos(lo), radius * Math.sin(a), radius * Math.cos(a) * Math.sin(lo),
        radius * Math.cos(b) * Math.cos(lo), radius * Math.sin(b), radius * Math.cos(b) * Math.sin(lo),
      );
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

function Earth({ day, night, line }: { day: string; night: string; line: string }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: earthVert,
        fragmentShader: earthFrag,
        uniforms: {
          uDay: { value: new THREE.Color(day) },
          uNight: { value: new THREE.Color(night) },
          uSunDir: { value: new THREE.Vector3(-1, 0, 0) },
        },
      }),
    [day, night],
  );
  const grid = useMemo(() => graticule(EARTH_R * 1.004), []);
  useEffect(() => () => (mat.dispose(), grid.dispose()), [mat, grid]);
  return (
    <group position={[EARTH_X, 0, 0]} rotation={[0, 0, (-23.4 * Math.PI) / 180]}>
      <mesh material={mat}>
        <sphereGeometry args={[EARTH_R, 32, 24]} />
      </mesh>
      <lineSegments geometry={grid}>
        <lineBasicMaterial color={line} transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}

// ─── Magnetopause ────────────────────────────────────────────────────────────

function shueCurve(mp: Magnetopause, steps = 40): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * (Math.PI * 0.72);
    const r = mp.r0 * Math.pow(2 / (1 + Math.cos(theta)), mp.alpha) * RE;
    out.push([-r * Math.cos(theta), r * Math.sin(theta)]);
  }
  return out;
}

/** Shue surface drawn as meridians and a few rings, like a wire model. */
function MagnetopauseLines({ mp, color }: { mp: Magnetopause; color: string }) {
  const geom = useMemo(() => {
    const curve = shueCurve(mp);
    const pts: number[] = [];
    const meridians = 12;
    for (let m = 0; m < meridians; m++) {
      const phi = (m / meridians) * Math.PI * 2;
      for (let i = 0; i < curve.length - 1; i++) {
        const [x0, r0] = curve[i];
        const [x1, r1] = curve[i + 1];
        pts.push(x0, r0 * Math.cos(phi), r0 * Math.sin(phi), x1, r1 * Math.cos(phi), r1 * Math.sin(phi));
      }
    }
    for (const idx of [8, 18, 30]) {
      const [x, r] = curve[idx];
      const seg = 48;
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const b = ((i + 1) / seg) * Math.PI * 2;
        pts.push(x, r * Math.cos(a), r * Math.sin(a), x, r * Math.cos(b), r * Math.sin(b));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [mp]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <lineSegments geometry={geom} position={[EARTH_X, 0, 0]}>
      <lineBasicMaterial color={color} transparent opacity={0.32} depthWrite={false} />
    </lineSegments>
  );
}

// ─── Solar wind ──────────────────────────────────────────────────────────────

/**
 * Every particle position is computed in the vertex shader from time and a
 * per-particle seed, so the CPU does nothing per frame. Particles that would
 * enter the Shue surface are pushed onto it, which drapes the flow around the
 * magnetosphere.
 */
const windVert = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime;
uniform float uSpeed;
uniform float uStart;
uniform float uLen;
uniform vec3 uEarth;
uniform float uR0;
uniform float uAlpha;
uniform float uSize;
varying float vFade;
void main() {
  float prog = fract(aSeed.x + uTime * uSpeed / uLen);
  float x = uStart + prog * uLen;
  float spread = 0.25 + 0.16 * (x - uStart);
  vec3 p = vec3(x, aSeed.y * spread, aSeed.z * spread);
  vec3 rel = p - uEarth;
  float r = length(rel);
  float c = clamp(-rel.x / max(r, 1e-4), -0.85, 1.0);
  float rmp = uR0 * pow(2.0 / (1.0 + c), uAlpha);
  if (r < rmp) {
    p = uEarth + normalize(rel + vec3(0.0, 0.0001, 0.0)) * rmp;
  }
  vFade = smoothstep(0.0, 0.06, prog) * (1.0 - smoothstep(0.9, 1.0, prog));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (8.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const windFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  if (dot(d, d) > 0.25) discard;
  gl_FragColor = vec4(uColor, uOpacity * vFade);
}`;

function SolarWind({
  count,
  speed,
  density,
  mp,
  color,
  animate,
}: {
  count: number;
  speed: number;
  density: number;
  mp: Magnetopause;
  color: string;
  animate: boolean;
}) {
  const geom = useMemo(() => {
    const seeds = new Float32Array(count * 3);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      seeds[i * 3] = Math.random();
      // Uniform in a disc so the stream looks like a cross-section, not a plus sign.
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      seeds[i * 3 + 1] = r * Math.cos(a);
      seeds[i * 3 + 2] = r * Math.sin(a);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    // Positions live in the shader; give culling a box that covers the whole stream.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 30);
    return g;
  }, [count]);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: windVert,
        fragmentShader: windFrag,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uSpeed: { value: 1 },
          uStart: { value: SUN_X + SUN_R },
          uLen: { value: EARTH_X + 5 - (SUN_X + SUN_R) },
          uEarth: { value: new THREE.Vector3(EARTH_X, 0, 0) },
          uR0: { value: 3 },
          uAlpha: { value: 0.58 },
          uSize: { value: 2.2 },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: 0.5 },
        },
      }),
    [color],
  );
  useEffect(() => () => (geom.dispose(), mat.dispose()), [geom, mat]);

  const dpr = useThree((s) => s.viewport.dpr);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const u = mat.uniforms;
    // 400 km/s crosses the scene in ~10 s; speed reads directly as pace.
    u.uSpeed.value = (speed / 400) * 1.6;
    u.uR0.value = mp.r0 * RE;
    u.uAlpha.value = mp.alpha;
    u.uOpacity.value = Math.min(0.85, 0.28 + density / 30);
    u.uSize.value = 2.2 * dpr;
    invalidate();
  }, [mat, speed, density, mp, dpr, invalidate]);

  useFrame((_, dt) => {
    if (animate) mat.uniforms.uTime.value += Math.min(dt, 0.1);
  });

  return <points geometry={geom} material={mat} frustumCulled={false} />;
}

// ─── IMF arrow at L1 ─────────────────────────────────────────────────────────

function BzArrow({ bz, north, south }: { bz: number | null; north: string; south: string }) {
  const invalidate = useThree((s) => s.invalidate);
  const arrow = useMemo(() => new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(L1_X, 0, 0), 1, north, 0.18, 0.1), [north]);
  useEffect(() => {
    if (bz == null) {
      arrow.visible = false;
      return;
    }
    arrow.visible = true;
    arrow.setDirection(new THREE.Vector3(0, bz >= 0 ? 1 : -1, 0));
    arrow.setLength(0.35 + Math.min(1.6, Math.abs(bz) / 12), 0.18, 0.1);
    arrow.setColor(bz >= 0 ? north : south);
    invalidate();
  }, [arrow, bz, north, south, invalidate]);
  useEffect(
    () => () => {
      arrow.dispose();
    },
    [arrow],
  );
  return <primitive object={arrow} />;
}

// ─── Reference axis and L1 ───────────────────────────────────────────────────

function Axis({ color }: { color: string }) {
  const geom = useMemo(() => {
    const pts: number[] = [SUN_X + SUN_R, 0, 0, EARTH_X + 4, 0, 0];
    // Tick every 0.1 AU, longer at 0.5 and 1.0.
    for (let i = 1; i <= 10; i++) {
      const x = auToX(i / 10);
      const h = i % 5 === 0 ? 0.22 : 0.1;
      pts.push(x, -h, 0, x, h, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color={color} transparent opacity={0.5} />
    </lineSegments>
  );
}

function L1Marker({ color }: { color: string }) {
  return (
    <mesh position={[L1_X, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
      <boxGeometry args={[0.14, 0.14, 0.14]} />
      <meshBasicMaterial color={color} wireframe />
    </mesh>
  );
}

// ─── CMEs ────────────────────────────────────────────────────────────────────

function CmeShell({ au, halfAngle, lat, lon, color }: { au: number; halfAngle: number; lat: number | null; lon: number | null; color: string }) {
  const geom = useMemo(
    () => new THREE.SphereGeometry(1, 18, 3, 0, Math.PI * 2, 0, (Math.min(70, Math.max(10, halfAngle)) * Math.PI) / 180),
    [halfAngle],
  );
  useEffect(() => () => geom.dispose(), [geom]);
  const quat = useMemo(() => {
    const [x, y, z] = cmeDirection(lat, lon);
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, z));
  }, [lat, lon]);
  const r = Math.max(0.01, auToX(au) - SUN_X);
  return (
    <mesh geometry={geom} position={[SUN_X, 0, 0]} quaternion={quat} scale={[r, r, r]}>
      <meshBasicMaterial color={color} wireframe transparent opacity={0.22} depthWrite={false} />
    </mesh>
  );
}

// ─── Labels (HTML, positioned by projecting 3D anchors) ──────────────────────

function LabelSync({ labels, mp }: { labels: React.RefObject<LabelRefs>; mp: Magnetopause }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const l = labels.current;
    if (!l) return;
    const place = (el: HTMLElement | null, x: number, y: number) => {
      if (!el) return;
      v.set(x, y, 0).project(camera);
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`;
    };
    place(l.sun, SUN_X, -SUN_R - 0.35);
    place(l.l1, L1_X, -0.45);
    place(l.earth, EARTH_X, -EARTH_R - 0.4);
    place(l.mp, EARTH_X - mp.r0 * RE, mp.r0 * RE * 0.55 + 0.3);
  });
  return null;
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function Scene3D({ snapshot, tier, colors, animate, labels, onSlow }: Props) {
  const spec = TIERS[tier];
  const mp = snapshot.magnetopause ?? DEFAULT_MP;

  return (
    <Canvas
      key={`${tier}`}
      frameloop="demand"
      dpr={spec.dpr}
      gl={{ antialias: spec.antialias, powerPreference: 'low-power', alpha: true }}
      camera={{ position: [0.5, 5.2, 13.5], fov: 38, near: 0.1, far: 100 }}
      style={{ touchAction: 'pan-y' }}
    >
      <Pacer animate={animate} fps={spec.fps} onSlow={onSlow} />
      <Controls />
      <Sun color={colors.sun} granulation={spec.granulation} animate={animate} />
      <Axis color={colors.text3} />
      <L1Marker color={colors.text} />
      <BzArrow bz={snapshot.bz} north={colors.north} south={colors.south} />
      <Earth day={colors.text} night={colors.bg} line={colors.text3} />
      <MagnetopauseLines mp={mp} color={colors.text} />
      <SolarWind
        count={spec.particles}
        speed={snapshot.speed ?? 400}
        density={snapshot.density ?? 5}
        mp={mp}
        color={colors.text}
        animate={animate}
      />
      {snapshot.cmesInFlight.slice(-4).map(({ track, au }) => (
        <CmeShell key={track.id} au={au} halfAngle={track.halfAngle ?? 45} lat={track.lat} lon={track.lon} color={colors.model} />
      ))}
      <LabelSync labels={labels} mp={mp} />
    </Canvas>
  );
}
