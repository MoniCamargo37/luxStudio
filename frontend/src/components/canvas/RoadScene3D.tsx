import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Grid, Html, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useConfigStore } from '../../store/useConfigStore';

type Photometric = {
  id: string;
  c: number[];
  gamma: number[];
  intensity: number[][];
  conv: number;
  flux: number;
  power: number;
  Mc: number;
  Ng: number;
  isym: number;
  LORL: number;
};

type PoleInfo = {
  id: number;
  baseX: number;
  baseZ: number;
  headX: number;
  headY: number;
  headZ: number;
  tiltRad: number;
};

const COLORS = {
  asphalt: '#1f2937',
  sidewalk: '#9ca3af',
  laneMark: '#f8fafc',
  pole: '#475569',
  arm: '#475569',
  headBody: '#fbbf24',
  headGlass: '#fef3c7',
  ground: '#020617',
  grid: '#1e293b',
  probe: '#22d3ee',
};

function sampleIntensity(p: Photometric, cDeg: number, gammaDeg: number): number {
  const Mc = p.Mc;
  const Ng = p.Ng;
  const cStep = 360 / Mc;
  const gStep = 180 / (Ng - 1);
  const ci = (((cDeg % 360) + 360) % 360) / cStep;
  const c0 = Math.floor(ci) % Mc;
  const c1 = (c0 + 1) % Mc;
  const tc = ci - Math.floor(ci);
  const gClamped = Math.max(0, Math.min(180, gammaDeg));
  const gi = gClamped / gStep;
  const g0 = Math.max(0, Math.min(Ng - 1, Math.floor(gi)));
  const g1 = Math.max(0, Math.min(Ng - 1, g0 + 1));
  const tg = gi - g0;
  const v =
    (1 - tc) * (1 - tg) * p.intensity[c0][g0] +
    (1 - tc) * tg * p.intensity[c0][g1] +
    tc * (1 - tg) * p.intensity[c1][g0] +
    tc * tg * p.intensity[c1][g1];
  return Math.max(0, v) * p.conv;
}

function computeEAt(
  px: number,
  pz: number,
  poles: PoleInfo[],
  p: Photometric,
): number {
  const yFluxScale = (p.flux * p.conv) / 1000;
  let E = 0;
  for (const pole of poles) {
    const hx = pole.headX;
    const hy = pole.headY;
    const hz = pole.headZ;
    const ax = px - hx;
    const az = pz - hz;
    const ay = 0 - hy;
    const d = Math.sqrt(ax * ax + ay * ay + az * az);
    if (d < 0.3) continue;
    const cosG = -ay / d;
    if (cosG <= 0) continue;
    const gamma = (Math.acos(Math.min(1, cosG)) * 180) / Math.PI;
    if (gamma > 90) continue;
    const c = (Math.atan2(az, ax) * 180) / Math.PI;
    const I = sampleIntensity(p, c, gamma);
    E += (I * yFluxScale * cosG) / (d * d);
  }
  return E;
}

function computeFieldStats(
  poles: PoleInfo[],
  p: Photometric,
  cfg: { road_width: number; sidewalk_left: number; sidewalk_right: number; spacing: number },
): { maxE: number; avgE: number; minE: number } {
  const W = cfg.road_width;
  const sl = cfg.sidewalk_left;
  const sr = cfg.sidewalk_right;
  const length = Math.max(cfg.spacing * 2, 30);
  const nx = 60;
  const nz = 20;
  const dx = length / nx;
  const dz = (W + sl + sr) / nz;
  const x0 = -length / 2;
  const z0 = -sl;
  const yFluxScale = (p.flux * p.conv) / 1000;
  let sum = 0;
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (let i = 0; i < nx; i++) {
    const px2 = x0 + (i + 0.5) * dx;
    for (let j = 0; j < nz; j++) {
      const pz2 = z0 + (j + 0.5) * dz;
      let E2 = 0;
      for (const pole of poles) {
        const hx = pole.headX;
        const hy = pole.headY;
        const hz = pole.headZ;
        const ax = px2 - hx;
        const az2 = pz2 - hz;
        const ay2 = 0 - hy;
        const d = Math.sqrt(ax * ax + ay2 * ay2 + az2 * az2);
        if (d < 0.3) continue;
        const cosG = -ay2 / d;
        if (cosG <= 0) continue;
        const gamma = (Math.acos(Math.min(1, cosG)) * 180) / Math.PI;
        if (gamma > 90) continue;
        const c = (Math.atan2(az2, ax) * 180) / Math.PI;
        const I = sampleIntensity(p, c, gamma);
        E2 += (I * yFluxScale * cosG) / (d * d);
      }
      sum += E2;
      if (E2 < minVal) minVal = E2;
      if (E2 > maxVal) maxVal = E2;
    }
  }
  const total = nx * nz;
  return { maxE: maxVal, avgE: sum / total, minE: minVal };
}

function buildPoles(cfg: ReturnType<typeof useConfigStore.getState>): PoleInfo[] {
  const S = cfg.spacing;
  const W = cfg.road_width;
  const arrangement = cfg.arrangement;
  const arm = Math.max(0, cfg.arm_length - cfg.pole_offset);
  const tilt = (cfg.tilt * Math.PI) / 180;
  const h = cfg.height;
  const side = cfg.pole_side === 'right' ? 1 : -1;
  const poles: PoleInfo[] = [];
  const halfS = S / 2;

  const placeRow = (xBase: number, zBase: number, idOffset: number) => {
    const headX = xBase;
    const headY = h + arm * Math.sin(tilt);
    const headZ = zBase + arm * Math.cos(tilt);
    poles.push({ id: idOffset, baseX: xBase, baseZ: zBase, headX, headY, headZ, tiltRad: tilt });
  };

  if (arrangement === 'Lineal') {
    const zBase = (side < 0 ? -cfg.pole_offset : W + cfg.pole_offset);
    for (let i = -1; i <= 1; i++) placeRow(i * S, zBase, poles.length);
  } else if (arrangement === 'Bilateral') {
    const zL = -cfg.pole_offset;
    const zR = W + cfg.pole_offset;
    for (let i = -1; i <= 1; i++) {
      const phase = i % 2 === 0 ? 0 : halfS;
      placeRow(i * S + phase, zL, poles.length);
      placeRow(i * S + phase, zR, poles.length);
    }
  } else if (arrangement === 'Central Doble') {
    for (let i = -1; i <= 1; i++) {
      placeRow(i * S, W / 2, poles.length);
      placeRow(i * S, W / 2, poles.length);
    }
  } else if (arrangement === 'En Isleta') {
    for (let i = -1; i <= 1; i++) placeRow(i * S, W / 2, poles.length);
  }
  return poles;
}

function Road({ cfg, onGroundClick }: { cfg: ReturnType<typeof useConfigStore.getState>; onGroundClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const W = cfg.road_width;
  const sl = cfg.sidewalk_left;
  const sr = cfg.sidewalk_right;
  const lanes = cfg.lanes;
  const length = Math.max(cfg.spacing * 2.4, 30);
  const totalWidth = sl + W + sr;
  const halfW = totalWidth / 2;

  const dashX = useMemo(() => {
    const arr: number[] = [];
    const dash = 0.6;
    const gap = 0.9;
    for (let x = -length / 2 + 0.3; x < length / 2; x += dash + gap) {
      arr.push(x + dash / 2);
    }
    return arr;
  }, [length]);

  return (
    <group>
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, halfW - sl - totalWidth / 2]}
      >
        <planeGeometry args={[length, totalWidth + 4]} />
        <meshStandardMaterial color={COLORS.ground} roughness={1} />
      </mesh>
      {sl > 0 && (
        <mesh
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.002, -sl / 2]}
          onClick={onGroundClick}
        >
          <planeGeometry args={[length, sl]} />
          <meshPhysicalMaterial color={COLORS.sidewalk} roughness={0.85} clearcoat={0.2} clearcoatRoughness={0.6} />
        </mesh>
      )}
      {sr > 0 && (
        <mesh
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.002, W + sr / 2]}
          onClick={onGroundClick}
        >
          <planeGeometry args={[length, sr]} />
          <meshPhysicalMaterial color={COLORS.sidewalk} roughness={0.85} clearcoat={0.2} clearcoatRoughness={0.6} />
        </mesh>
      )}
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.005, W / 2]}
        onClick={onGroundClick}
      >
        <planeGeometry args={[length, W]} />
          <meshPhysicalMaterial
            color={COLORS.asphalt}
            roughness={0.55}
            metalness={0.05}
            clearcoat={0.45}
            clearcoatRoughness={0.35}
          />
      </mesh>
      {sl > 0 && (
        <mesh receiveShadow position={[0, 0.03, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[length, 0.06, 0.08]} />
          <meshStandardMaterial color="#6b7280" roughness={0.5} metalness={0.3} />
        </mesh>
      )}
      {sr > 0 && (
        <mesh receiveShadow position={[0, 0.03, W]} rotation={[0, 0, 0]}>
          <boxGeometry args={[length, 0.06, 0.08]} />
          <meshStandardMaterial color="#6b7280" roughness={0.5} metalness={0.3} />
        </mesh>
      )}
      {Array.from({ length: Math.max(0, lanes - 1) }).map((_, i) => {
        const z = ((i + 1) * W) / lanes;
        return (
          <group key={i} position={[0, 0.012, z]}>
            {dashX.map((x, j) => (
              <mesh key={j} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, 0]}>
                <planeGeometry args={[0.6, 0.12]} />
                <meshStandardMaterial color={COLORS.laneMark} emissive="#fef3c7" emissiveIntensity={0.08} />
              </mesh>
            ))}
          </group>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
        <planeGeometry args={[length, 0.15]} />
        <meshStandardMaterial color={COLORS.laneMark} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, W]}>
        <planeGeometry args={[length, 0.15]} />
        <meshStandardMaterial color={COLORS.laneMark} />
      </mesh>
    </group>
  );
}

function Pole({ pole, cfg }: { pole: PoleInfo; cfg: ReturnType<typeof useConfigStore.getState> }) {
  const dz = pole.headZ - pole.baseZ;
  const dy = pole.headY - cfg.height;
  const armLen = Math.sqrt(dz * dz + dy * dy);
  const armAngleX = Math.atan2(dz, dy);
  const headTiltX = pole.tiltRad;

  return (
    <group>
      <mesh castShadow position={[pole.baseX, cfg.height / 2, pole.baseZ]}>
        <cylinderGeometry args={[0.06, 0.08, cfg.height, 16]} />
        <meshStandardMaterial color={COLORS.pole} metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[pole.baseX, 0.05, pole.baseZ]}>
        <cylinderGeometry args={[0.18, 0.24, 0.1, 16]} />
        <meshStandardMaterial color={COLORS.pole} metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh castShadow position={[pole.baseX, cfg.height, pole.baseZ]}>
        <sphereGeometry args={[0.1, 12, 8]} />
        <meshStandardMaterial color={COLORS.pole} metalness={0.7} roughness={0.4} />
      </mesh>
      <group position={[pole.baseX, cfg.height, pole.baseZ]} rotation={[armAngleX, 0, 0]}>
        <mesh castShadow position={[0, armLen / 2, 0]}>
          <cylinderGeometry args={[0.04, 0.05, armLen, 12]} />
          <meshStandardMaterial color={COLORS.arm} metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh castShadow position={[0, armLen, 0]}>
          <sphereGeometry args={[0.07, 12, 8]} />
          <meshStandardMaterial color={COLORS.arm} metalness={0.7} roughness={0.4} />
        </mesh>
        <group position={[0, armLen, 0]} rotation={[headTiltX, 0, 0]}>
          <mesh castShadow position={[0, -0.06, 0]}>
            <boxGeometry args={[0.42, 0.12, 0.22]} />
            <meshStandardMaterial color={COLORS.headBody} metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh castShadow position={[0, -0.14, 0]}>
            <boxGeometry args={[0.38, 0.03, 0.2]} />
            <meshStandardMaterial
              color={COLORS.headGlass}
              metalness={0.1}
              roughness={0.1}
              emissive="#0ea5e9"
              emissiveIntensity={0.7}
              transparent
              opacity={0.75}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function PhotometricSolid({ pole, p, scale = 0.5 }: { pole: PoleInfo; p: Photometric; scale?: number }) {
  const geometry = useMemo(() => {
    const Mc = p.Mc;
    const Ng = p.Ng;
    const geom = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const maxI = Math.max(1e-6, ...p.intensity.flat());
    const color = new THREE.Color('#fde68a');

    for (let ci = 0; ci < Mc; ci++) {
      for (let gi = 0; gi < Ng; gi++) {
        const c = (p.c[ci] * Math.PI) / 180;
        const g = (p.gamma[gi] * Math.PI) / 180;
        const I = p.intensity[ci][gi] / maxI;
        const r = scale * (0.05 + I * 1.4);
        const x = r * Math.sin(g) * Math.cos(c);
        const z = r * Math.sin(g) * Math.sin(c);
        const y = -r * Math.cos(g);
        positions.push(x, y, z);
        const fade = 0.2 + I * 0.6;
        colors.push(color.r * fade * 1.5, color.g * fade * 1.5, color.b * fade * 1.2);
      }
    }
    for (let ci = 0; ci < Mc; ci++) {
      const c1 = (ci + 1) % Mc;
      for (let gi = 0; gi < Ng - 1; gi++) {
        const a = ci * Ng + gi;
        const b = c1 * Ng + gi;
        const cc = c1 * Ng + (gi + 1);
        const d = ci * Ng + (gi + 1);
        indices.push(a, b, cc, a, cc, d);
      }
    }
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [p, scale]);

  return (
    <group position={[pole.headX, pole.headY, pole.headZ]} rotation={[pole.tiltRad, 0, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
          emissive="#fde68a"
          emissiveIntensity={0.4}
        />
      </mesh>
      <pointLight
        intensity={Math.min(2, p.flux * 0.0015)}
        distance={Math.min(20, p.flux * 0.01)}
        decay={2}
        color="#fff5d6"
        position={[0, -0.05, 0]}
      />
    </group>
  );
}

function IsoluxContours({
  poles,
  p,
  cfg,
}: {
  poles: PoleInfo[];
  p: Photometric;
  cfg: ReturnType<typeof useConfigStore.getState>;
}) {
  const data = useMemo(() => {
    const W = cfg.road_width;
    const sl = cfg.sidewalk_left;
    const sr = cfg.sidewalk_right;
    const length = Math.max(cfg.spacing * 2, 30);
    const nx = 120;
    const nz = 40;
    const dx = length / nx;
    const dz = (W + sl + sr) / nz;
    const x0 = -length / 2;
    const z0 = -sl;
    const field: number[][] = [];
    const yFluxScale = (p.flux * p.conv) / 1000;
    for (let i = 0; i < nx; i++) {
      const row: number[] = [];
      const px = x0 + (i + 0.5) * dx;
      for (let j = 0; j < nz; j++) {
        const pz = z0 + (j + 0.5) * dz;
        let E = 0;
        for (const pole of poles) {
          const hx = pole.headX;
          const hy = pole.headY;
          const hz = pole.headZ;
          const ax = px - hx;
          const az = pz - hz;
          const ay = 0 - hy;
          const d = Math.sqrt(ax * ax + ay * ay + az * az);
          if (d < 0.3) continue;
          const cosG = -ay / d;
          if (cosG <= 0) continue;
          const gamma = (Math.acos(Math.min(1, cosG)) * 180) / Math.PI;
          if (gamma > 90) continue;
          const c = (Math.atan2(az, ax) * 180) / Math.PI;
          const I = sampleIntensity(p, c, gamma);
          E += (I * yFluxScale * cosG) / (d * d);
        }
        row.push(E);
      }
      field.push(row);
    }
    const colorStops = [
      { t: 0.0, c: new THREE.Color('#020617') },
      { t: 0.15, c: new THREE.Color('#1e1b4b') },
      { t: 0.3, c: new THREE.Color('#581c87') },
      { t: 0.45, c: new THREE.Color('#9a3412') },
      { t: 0.6, c: new THREE.Color('#facc15') },
      { t: 0.78, c: new THREE.Color('#fef08a') },
      { t: 1.0, c: new THREE.Color('#ffffff') },
    ];
    const maxE = Math.max(1, ...field.flat());
    const vmax = maxE;
    const samples: { x: number; y: number; z: number; e: number; color: THREE.Color }[] = [];
    let maxX = 0;
    let maxZ = 0;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const e = field[i][j];
        const t = Math.min(1, Math.max(0, e / vmax));
        let color = colorStops[0].c;
        for (let k = 0; k < colorStops.length - 1; k++) {
          const a = colorStops[k];
          const b = colorStops[k + 1];
          if (t >= a.t && t <= b.t) {
            const f = (t - a.t) / (b.t - a.t);
            color = a.c.clone().lerp(b.c, f);
            break;
          }
        }
        const sx = x0 + (i + 0.5) * dx;
        const sz = z0 + (j + 0.5) * dz;
        samples.push({ x: sx, y: 0.02, z: sz, e, color });
        if (e > 0 && e >= maxE * 0.999) {
          maxX = sx;
          maxZ = sz;
        }
      }
    }
    const avgE = field.reduce((s, row) => s + row.reduce((a, v) => a + v, 0), 0) / (nx * nz);
    const minE = Math.min(...field.flat().filter((v) => v > 0));
    return { samples, maxE, maxX, maxZ, avgE, minE, length, W, sl, sr };
  }, [poles, p, cfg]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(data.samples.length * 3);
    const colors = new Float32Array(data.samples.length * 3);
    data.samples.forEach((s, i) => {
      positions[i * 3] = s.x;
      positions[i * 3 + 1] = s.y;
      positions[i * 3 + 2] = s.z;
      colors[i * 3] = s.color.r;
      colors[i * 3 + 1] = s.color.g;
      colors[i * 3 + 2] = s.color.b;
    });
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [data]);

  return (
    <group>
      <points geometry={geometry}>
        <pointsMaterial
          vertexColors
          size={0.22}
          sizeAttenuation
          transparent
          opacity={0.95}
          depthWrite={false}
        />
      </points>
      <Html
        position={[data.maxX, 0.35, data.maxZ]}
        center
        style={{ pointerEvents: 'none' }}
        distanceFactor={10}
      >
        <div className="text-[10px] text-amber-200 font-mono px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 whitespace-pre shadow-lg shadow-amber-500/20">
{`E max = ${data.maxE.toFixed(1)} lx`}
        </div>
      </Html>
      <Html
        position={[-data.length / 2 + 0.5, 0.35, data.W / 2]}
        style={{ pointerEvents: 'none' }}
        distanceFactor={10}
      >
        <div className="text-[9px] text-sky-300/90 font-mono px-1.5 py-0.5 rounded bg-slate-900/80 border border-sky-400/30 whitespace-pre">
{`E front edge = ${(() => {
  const frontE = (() => {
    const poles2 = poles;
    let E = 0;
    for (const pole of poles2) {
      const hx = pole.headX;
      const hy = pole.headY;
      const hz = pole.headZ;
      const ax = -data.length / 2 + 0.5 - hx;
      const az = data.W / 2 - hz;
      const ay = 0 - hy;
      const d = Math.sqrt(ax * ax + ay * ay + az * az);
      if (d < 0.3) continue;
      const cosG = -ay / d;
      if (cosG <= 0) continue;
      const gamma = (Math.acos(Math.min(1, cosG)) * 180) / Math.PI;
      const c = (Math.atan2(az, ax) * 180) / Math.PI;
      const I = sampleIntensity(p, c, gamma);
      E += (I * (p.flux * p.conv) / 1000 * cosG) / (d * d);
    }
    return E;
  })();
  return frontE.toFixed(1);
})()} lx`}
        </div>
      </Html>
      <Html
        position={[0, 0.35, data.W + data.sr + 0.4]}
        center
        style={{ pointerEvents: 'none' }}
        distanceFactor={10}
      >
        <div className="text-[9px] text-emerald-300/90 font-mono px-1.5 py-0.5 rounded bg-slate-900/80 border border-emerald-400/30 whitespace-pre">
{`E avg = ${data.avgE.toFixed(1)} lx`}
        </div>
      </Html>
    </group>
  );
}

function Probe({
  point,
  value,
  cfg,
  onClear,
}: {
  point: { x: number; z: number };
  value: number;
  cfg: ReturnType<typeof useConfigStore.getState>;
  onClear: () => void;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const { x, z } = point;
  const arm = Math.max(0, cfg.arm_length - cfg.pole_offset);
  const W = cfg.road_width;
  const sl = cfg.sidewalk_left;
  const sr = cfg.sidewalk_right;
  const distFront = z;
  const distBack = W - z;
  const distNearPoleX = (() => {
    let best = Infinity;
    for (const sign of [-1, 0, 1]) {
      const px = sign * cfg.spacing;
      const d = Math.abs(x - px);
      if (d < best) best = d;
    }
    return best;
  })();
  const distFromCenter = Math.abs(z - W / 2);
  const onSidewalk = z < 0 ? 'L' : z > W ? 'R' : 'C';
  const sidewalkLabel = onSidewalk === 'L' ? ` (sidewalk L)` : onSidewalk === 'R' ? ` (sidewalk R)` : '';

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.18;
    ringRef.current.scale.set(s, s, s);
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.7 + Math.sin(clock.elapsedTime * 4) * 0.25;
  });

  return (
    <group>
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[x, 0.03, z]}
      >
        <ringGeometry args={[0.28, 0.36, 36]} />
        <meshBasicMaterial color={COLORS.probe} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.025, z]}>
        <circleGeometry args={[0.08, 24]} />
        <meshBasicMaterial color={COLORS.probe} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh position={[x, 2.85, z]}>
        <cylinderGeometry args={[0.012, 0.012, 5.7, 8]} />
        <meshBasicMaterial color={COLORS.probe} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh position={[x, 5.7, z]}>
        <sphereGeometry args={[0.06, 16, 12]} />
        <meshBasicMaterial color={COLORS.probe} />
      </mesh>
      <Html
        position={[x, 5.95, z]}
        center
        style={{ pointerEvents: 'auto' }}
        distanceFactor={10}
      >
        <div
          onClick={onClear}
          className="text-lg font-bold font-mono px-4 py-3 rounded-md bg-black/90 border-2 border-cyan-400 text-cyan-200 shadow-lg shadow-cyan-500/50 cursor-pointer whitespace-pre select-none leading-relaxed"
        >
{`✦ E = ${value.toFixed(2)} lx${sidewalkLabel}
x = ${x >= 0 ? '+' : ''}${x.toFixed(2)} m
z = ${z.toFixed(2)} m
z − front = ${distFront.toFixed(2)} m
back − z = ${distBack.toFixed(2)} m
|center − z| = ${distFromCenter.toFixed(2)} m
nearest pole = ${distNearPoleX.toFixed(2)} m`}
        </div>
      </Html>
    </group>
  );
}

function AutoRotate({ enabled }: { enabled: boolean }) {
  const { camera } = useThree();
  const t = useRef(0);
  const targetRadius = useRef(Math.sqrt(18 * 18 + 22 * 22));
  const cfg = useConfigStore.getState();
  useFrame((_, delta) => {
    if (!enabled) return;
    t.current += delta;
    const r = targetRadius.current;
    const y = camera.position.y;
    const angle = t.current * 0.1;
    camera.position.x = r * Math.sin(angle);
    camera.position.z = r * Math.cos(angle);
    camera.position.y = y;
    camera.lookAt(0, cfg.height * 0.5, cfg.road_width / 2);
  });
  return null;
}

function Scene({
  photometric,
  probe,
  onGroundClick,
  onClearProbe,
}: {
  photometric: Photometric | null;
  probe: { x: number; z: number; value: number } | null;
  onGroundClick: (e: ThreeEvent<MouseEvent>) => void;
  onClearProbe: () => void;
}) {
  const cfg = useConfigStore();
  const poles = useMemo(() => buildPoles(cfg), [cfg]);

  return (
    <>
      <color attach="background" args={['#05070d']} />
      <fog attach="fog" args={['#05070d', 35, 120]} />
      <Stars radius={120} depth={50} count={2500} factor={4} saturation={0.2} fade speed={0.6} />
      <hemisphereLight args={['#3b4a6b', '#0a0e1a', 0.35]} />
      <ambientLight intensity={0.15} />
      <directionalLight
        position={[15, 30, 10]}
        intensity={0.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <Road cfg={cfg} onGroundClick={onGroundClick} />
      <Grid
        args={[80, 80]}
        position={[0, -0.005, cfg.road_width / 2]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1e293b"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#334155"
        fadeDistance={50}
        fadeStrength={1.5}
        infiniteGrid
      />
      <Html
        position={[cfg.spacing / 2, 0.05, -cfg.sidewalk_left - 0.3]}
        center
        style={{ pointerEvents: 'none' }}
        distanceFactor={14}
        transform={false}
      >
        <div className="text-[10px] text-slate-300 font-mono px-1.5 py-0.5 rounded bg-slate-900/60 border border-slate-700/50 whitespace-pre">
{`S = ${cfg.spacing.toFixed(1)} m`}
        </div>
      </Html>
      {poles.map((pole) => (
        <Pole key={pole.id} pole={pole} cfg={cfg} />
      ))}
      {photometric &&
        poles.map((pole) => (
          <PhotometricSolid key={`sol-${pole.id}`} pole={pole} p={photometric} scale={0.65} />
        ))}
      {photometric && poles.length > 0 && <IsoluxContours poles={poles} p={photometric} cfg={cfg} />}
      {probe && (
        <Probe point={{ x: probe.x, z: probe.z }} value={probe.value} cfg={cfg} onClear={onClearProbe} />
      )}
      <ContactShadows
        position={[0, 0.025, cfg.road_width / 2]}
        opacity={0.5}
        scale={80}
        blur={2.5}
        far={20}
        resolution={1024}
      />
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.6}
          luminanceThreshold={0.55}
          luminanceSmoothing={0.25}
          mipmapBlur
          radius={0.7}
        />
        <Vignette eskil={false} offset={0.2} darkness={0.6} />
      </EffectComposer>
    </>
  );
}

export default function RoadScene3D({ onClose }: { onClose: () => void }) {
  const ldtId = useConfigStore((s) => s.ldt_id);
  const [photometric, setPhotometric] = useState<Photometric | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [probe, setProbe] = useState<{ x: number; z: number; value: number } | null>(null);

  useEffect(() => {
    if (!ldtId) {
      setError('Select a luminaire to view the 3D scene.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/ldt/${ldtId}/photometric`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Photometric) => {
        setPhotometric(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, [ldtId]);

  const poles = useMemo(() => buildPoles(useConfigStore.getState()), [photometric]);

  const fieldStats = useMemo(() => {
    if (!photometric || poles.length === 0) return null;
    return computeFieldStats(poles, photometric, useConfigStore.getState());
  }, [photometric, poles]);

  const handleGroundClick = (e: ThreeEvent<MouseEvent>) => {
    if (!photometric) return;
    e.stopPropagation();
    const x = e.point.x;
    const z = e.point.z;
    const value = computeEAt(x, z, poles, photometric);
    setProbe({ x, z, value });
    setAutoRotate(false);
  };

  const handleClearProbe = () => setProbe(null);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/80 bg-gradient-to-r from-slate-900 to-slate-950">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_2px_rgba(251,191,36,0.6)] animate-pulse" />
          <h2 className="text-slate-100 font-semibold text-sm tracking-wide">3D Road Preview</h2>
          {photometric && (
            <span className="text-[10px] font-mono text-slate-400 ml-2">
              {photometric.flux.toFixed(0)} lm · {photometric.power.toFixed(0)} W · {photometric.Mc}×{photometric.Ng}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRotate((v) => !v)}
            className="text-[11px] px-3 py-1.5 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            {autoRotate ? 'Stop rotation' : 'Auto rotate'}
          </button>
          <button
            onClick={onClose}
            className="text-[11px] px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            Close
          </button>
        </div>
      </div>
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm z-10">
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading photometric data...
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-red-300 text-sm z-10">
            {error}
          </div>
        )}
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [16, 10, 18], fov: 45, near: 0.1, far: 500 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <Scene
            photometric={photometric}
            probe={probe}
            onGroundClick={handleGroundClick}
            onClearProbe={handleClearProbe}
          />
          <AutoRotate enabled={autoRotate} />
          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            minDistance={5}
            maxDistance={60}
            maxPolarAngle={Math.PI / 2 - 0.05}
            target={[0, 3, 0]}
            onStart={() => setAutoRotate(false)}
          />
        </Canvas>
        <div className="absolute bottom-3 left-3 text-[10px] text-slate-300 font-mono bg-slate-900/80 border border-slate-700/50 px-2.5 py-1.5 rounded-md flex flex-col gap-1">
          <div>drag · rotate &nbsp;|&nbsp; wheel · zoom &nbsp;|&nbsp; right-drag · pan</div>
          <div className="text-cyan-300/90">click on the road · measure illuminance at any point</div>
        </div>
        <div className="absolute bottom-3 right-3 text-[10px] text-slate-300 bg-slate-900/85 border border-slate-700/60 px-2.5 py-2 rounded-md flex gap-2.5">
          <div className="flex flex-col justify-between h-[120px] my-0.5">
            {fieldStats ? (
              <>
                <span className="text-[9px] font-mono text-amber-200/90 leading-none">{fieldStats.maxE.toFixed(0)}</span>
                <span className="text-[9px] font-mono text-amber-300/60 leading-none">{(fieldStats.maxE * 0.5).toFixed(0)}</span>
                <span className="text-[9px] font-mono text-slate-500 leading-none">0</span>
              </>
            ) : (
              <>
                <span className="text-[9px] font-mono text-slate-600 leading-none">--</span>
                <span className="text-[9px] font-mono text-slate-600 leading-none">--</span>
                <span className="text-[9px] font-mono text-slate-600 leading-none">--</span>
              </>
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-3 rounded-sm flex-1"
              style={{ background: 'linear-gradient(to top,#020617 0%,#1e1b4b 15%,#581c87 30%,#9a3412 45%,#facc15 60%,#fef08a 78%,#fff 100%)' }}
            />
            <span className="text-[8px] text-slate-500 leading-none mt-0.5">lx</span>
          </div>
        </div>
        {probe && (
          <button
            onClick={handleClearProbe}
            className="absolute top-16 right-5 text-[10px] font-mono px-2.5 py-1.5 rounded-md bg-cyan-950/90 border border-cyan-400/60 text-cyan-100 hover:bg-cyan-900"
          >
            ✕ clear probe
          </button>
        )}
      </div>
    </div>
  );
}
