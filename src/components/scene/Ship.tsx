"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSiteStore } from "@/lib/store";
import { sceneTime } from "@/lib/sceneTime";
import { flightState } from "./useFlyTo";
import {
  createPanelMaterial,
  makeRng,
  profileRadiusAt,
  type Disposable,
} from "./ShipDetail";

const HULL = "#0e1626";
const HULL_DARK = "#080d18";
const GREEBLE = "#10192b";
const CYAN = "#22d3ee";
const CYAN_BRIGHT = "#a5f3fc";

// Scratch objects — allocated once, reused every frame.
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _altUp = new THREE.Vector3(0, 0, 1);
const _origin = new THREE.Vector3(0, 0, 0);
const _mat = new THREE.Matrix4();
const _qTarget = new THREE.Quaternion();
const _qRoll = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);

// --- Geometry builders (pure; invoked once inside useMemo) -----------------

/**
 * Hull silhouette as `[radius, axialHeight]` pairs (nose first). Shared by the
 * lathe builder and the surface sampler so greebles and running lights sit on
 * the real hull instead of a guessed cylinder.
 */
const HULL_PROFILE: readonly [number, number][] = [
  [0.0, 1.06],
  [0.05, 0.98],
  [0.11, 0.82],
  [0.17, 0.56],
  [0.225, 0.28],
  [0.262, 0.02],
  [0.275, -0.18],
  [0.255, -0.42],
  [0.205, -0.62],
  [0.16, -0.78],
  [0.125, -0.87],
  [0.06, -0.91],
  [0.0, -0.93],
];

/** Radius of the hull surface at a given local +Z axial coordinate. */
function hullRadiusAt(z: number): number {
  return profileRadiusAt(HULL_PROFILE, z);
}

/**
 * Swept-wing planform authored in the shape's XY plane: X is the spanwise axis,
 * Y is the chord (fore/aft). The leading edge runs along positive Y so, after
 * the geometry is stood upright, it points toward the ship's +Z nose.
 */
const WING_PTS: readonly [number, number][] = [
  [0.16, 0.32],
  [0.6, 0.05],
  [0.92, -0.28],
  [0.9, -0.46],
  [0.42, -0.5],
  [0.16, -0.72],
];

/** Compact dorsal fin, same authoring convention as the wings but smaller. */
const FIN_PTS: readonly [number, number][] = [
  [0.04, 0.04],
  [0.2, -0.14],
  [0.3, -0.34],
  [0.28, -0.46],
  [0.04, -0.44],
];

/**
 * Revolve the hand-authored silhouette (pointed nose, swelling midsection,
 * tapered tail) around the lathe's Y axis, then tip it so the nose points along
 * local +Z — the axis the flight controller orients the whole group toward.
 */
function buildHull(segments: number): THREE.LatheGeometry {
  const profile = HULL_PROFILE.map(([r, h]) => new THREE.Vector2(r, h));
  const geo = new THREE.LatheGeometry(profile, segments);
  geo.rotateX(Math.PI / 2); // nose (+Y) -> +Z, tail -> -Z
  return geo;
}

/**
 * Extrude a bevelled foil from a 2D planform. `sign` mirrors it across the
 * centreline for the opposite wing; the point order is reversed on the mirror
 * so the triangle winding (and therefore the normals) stays consistent. The
 * extruded slab is then laid flat: span along X, chord along Z, thin in Y.
 */
function buildFoil(
  pts: readonly [number, number][],
  sign: number,
  depth: number,
  bevelSegments: number,
): THREE.ExtrudeGeometry {
  const ordered = sign < 0 ? [...pts].reverse() : [...pts];
  const shape = new THREE.Shape();
  ordered.forEach(([x, y], i) => {
    const px = sign * x;
    if (i === 0) shape.moveTo(px, y);
    else shape.lineTo(px, y);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(0.02, depth * 0.4),
    bevelSize: 0.016,
    bevelSegments,
    steps: 1,
    curveSegments: 3,
  });
  geo.translate(0, 0, -depth / 2); // centre thickness on 0
  geo.rotateX(Math.PI / 2); // shape Y (chord) -> Z, thickness -> Y
  geo.computeVertexNormals();
  return geo;
}

/**
 * Exhaust cone whose wide mouth is pinned at the local origin and whose tip
 * trails toward -Z, so scaling the mesh stretches the plume straight out the
 * back of the engine instead of ballooning around its centre.
 */
function buildPlume(
  radius: number,
  length: number,
  radialSeg: number,
): THREE.ConeGeometry {
  const geo = new THREE.ConeGeometry(radius, length, radialSeg, 1, true);
  geo.translate(0, length / 2, 0); // mouth -> origin, tip -> +Y
  geo.rotateX(-Math.PI / 2); // tip -> -Z
  return geo;
}

/**
 * Scatter small mechanical boxes ("greebles") across the hull surface. Each is
 * seated on the true radius at its axial station and oriented so its thickness
 * points outward. Returns a single InstancedMesh — dozens of protrusions for
 * one draw call.
 */
function buildGreebleBoxes(rng: () => number): {
  mesh: THREE.InstancedMesh;
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
} {
  const n = new THREE.Vector3();
  const t = new THREE.Vector3();
  const ax = new THREE.Vector3(0, 0, 1);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const mats: THREE.Matrix4[] = [];

  const place = (z: number) => {
    const r = hullRadiusAt(z);
    if (r < 0.06) return;
    const phi = rng() * Math.PI * 2;
    n.set(Math.cos(phi), Math.sin(phi), 0);
    t.set(-Math.sin(phi), Math.cos(phi), 0);
    const w = 0.03 + rng() * 0.06;
    const l = 0.05 + rng() * 0.13;
    const h = 0.015 + rng() * 0.05;
    scl.set(w, l, h);
    pos.set(n.x * (r + h * 0.35), n.y * (r + h * 0.35), z);
    m.makeBasis(t, ax, n).scale(scl).setPosition(pos);
    mats.push(m.clone());
  };

  // General scatter along the flanks, then denser clusters around the engine
  // bay and the wing roots where the reference packs the most hardware.
  for (let i = 0; i < 42; i++) place(-0.82 + rng() * 1.5);
  for (let i = 0; i < 18; i++) place(-0.74 + rng() * 0.42);
  for (let i = 0; i < 10; i++) place(0.02 + rng() * 0.34);

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: GREEBLE,
    metalness: 0.86,
    roughness: 0.5,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, mats.length);
  for (let i = 0; i < mats.length; i++) mesh.setMatrixAt(i, mats[i]);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return { mesh, geo, mat };
}

/**
 * Scatter thin cylinders (pipes, conduits, thruster stubs) across the hull —
 * some running fore/aft, some wrapped tangentially — as a second InstancedMesh
 * sharing the greeble material palette.
 */
function buildGreeblePipes(rng: () => number): {
  mesh: THREE.InstancedMesh;
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
} {
  const n = new THREE.Vector3();
  const nn = new THREE.Vector3();
  const t = new THREE.Vector3();
  const ax = new THREE.Vector3(0, 0, 1);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const mats: THREE.Matrix4[] = [];

  for (let i = 0; i < 20; i++) {
    const z = -0.7 + rng() * 1.3;
    const r = hullRadiusAt(z);
    if (r < 0.08) continue;
    const phi = rng() * Math.PI * 2;
    n.set(Math.cos(phi), Math.sin(phi), 0);
    t.set(-Math.sin(phi), Math.cos(phi), 0);
    const rad = 0.012 + rng() * 0.016;
    const len = 0.12 + rng() * 0.22;
    pos.set(n.x * (r + rad * 0.5), n.y * (r + rad * 0.5), z);
    scl.set(rad, len, rad);
    // Half run along the hull axis, half wrap tangentially for variety. Both
    // bases are right-handed so instance normals never flip inside-out.
    if (rng() > 0.5) {
      m.makeBasis(t, ax, n); // cylinder axis -> hull axis (t × ax = n)
    } else {
      nn.copy(n).multiplyScalar(-1);
      m.makeBasis(ax, t, nn); // cylinder axis -> tangent (ax × t = -n)
    }
    m.scale(scl).setPosition(pos);
    mats.push(m.clone());
  }

  const geo = new THREE.CylinderGeometry(1, 1, 1, 8);
  const mat = new THREE.MeshStandardMaterial({
    color: GREEBLE,
    metalness: 0.8,
    roughness: 0.55,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, mats.length);
  for (let i = 0; i < mats.length; i++) mesh.setMatrixAt(i, mats[i]);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return { mesh, geo, mat };
}

/**
 * A row of emissive cyan running lights: two rings around the hull plus wingtip
 * beacons, all in one InstancedMesh so the whole set costs a single draw call
 * and blooms above the postprocessing threshold.
 */
function buildRunningLights(): {
  mesh: THREE.InstancedMesh;
  geo: THREE.BufferGeometry;
  mat: THREE.MeshStandardMaterial;
} {
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const mats: THREE.Matrix4[] = [];

  const ring = (z: number, count: number, size: number, lift: number) => {
    const r = hullRadiusAt(z) + lift;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      pos.set(Math.cos(a) * r, Math.sin(a) * r, z);
      m.makeScale(size, size, size).setPosition(pos);
      mats.push(m.clone());
    }
  };

  ring(-0.12, 22, 0.016, 0.014); // main rim row
  ring(0.36, 14, 0.012, 0.012); // forward shoulder row

  // Wingtip beacons.
  for (const sx of [1, -1]) {
    pos.set(sx * 0.88, -0.02, -0.28);
    m.makeScale(0.022, 0.022, 0.022).setPosition(pos);
    mats.push(m.clone());
  }

  const geo = new THREE.SphereGeometry(1, 8, 6);
  const mat = new THREE.MeshStandardMaterial({
    color: "#0a3a44",
    emissive: CYAN,
    emissiveIntensity: 2.6,
  });
  mat.toneMapped = false;
  const mesh = new THREE.InstancedMesh(geo, mat, mats.length);
  for (let i = 0; i < mats.length; i++) mesh.setMatrixAt(i, mats[i]);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return { mesh, geo, mat };
}

/**
 * Sleek interceptor built from a revolved, panel-lined hull with bevel-extruded
 * swept wings, scattered greebles, a row of running lights, a glass canopy and a
 * layered engine. The nose points along local +Z, so orienting the group toward
 * `flightState.shipForward` faces it into travel.
 */
export function Ship() {
  const group = useRef<THREE.Group>(null);
  const plumeRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  // Running-light material is held in a ref so the frame loop can pulse it
  // without mutating the memoized `geo` (which the React Compiler forbids).
  const runLightsMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const roll = useRef(0);
  const glow = useRef(flightState.throttle);
  // Fixed phase: there is only one ship, so a random offset buys nothing and
  // calling Math.random() during render is impure.
  const bobPhase = useRef(0);

  const quality = useSiteStore((s) => s.quality);
  const low = quality === "low";

  // Lathe/extrude/greeble loops are not free — build every custom geometry,
  // material and instanced set once per quality tier.
  const geo = useMemo(() => {
    const hullSeg = low ? 22 : 48;
    const bevel = low ? 1 : 2;
    const plumeSeg = low ? 10 : 20;

    const hull = buildHull(hullSeg);
    const hullMat = createPanelMaterial({
      color: HULL,
      metalness: 0.9,
      roughness: 0.36,
      emissive: HULL_DARK,
      emissiveIntensity: 0.25,
      uLines: 10,
      vLines: 16,
      seamStrength: 0.5,
      plateStrength: 0.16,
      lineWidth: 0.03,
      seed: 3,
    });
    const wingR = buildFoil(WING_PTS, 1, 0.05, bevel);
    const wingL = buildFoil(WING_PTS, -1, 0.05, bevel);
    const fin = buildFoil(FIN_PTS, 1, 0.045, bevel);
    const plume = buildPlume(0.17, 1.0, plumeSeg);
    const trail = low ? null : buildPlume(0.09, 1.0, plumeSeg);

    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: "#071722",
      metalness: 0.1,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      emissive: CYAN,
      emissiveIntensity: 0.35,
    });

    const disposables: Disposable[] = [
      hull,
      hullMat,
      wingR,
      wingL,
      fin,
      plume,
      canopyMat,
    ];
    if (trail) disposables.push(trail);

    // Instanced detail only earns its keep above the low tier.
    let boxGreebles: THREE.InstancedMesh | null = null;
    let pipeGreebles: THREE.InstancedMesh | null = null;
    let runLights: THREE.InstancedMesh | null = null;
    let runLightsMat: THREE.MeshStandardMaterial | null = null;

    if (!low) {
      const rng = makeRng(0x1a2b3c4d);
      const boxes = buildGreebleBoxes(rng);
      const pipes = buildGreeblePipes(rng);
      const lights = buildRunningLights();
      boxGreebles = boxes.mesh;
      pipeGreebles = pipes.mesh;
      runLights = lights.mesh;
      runLightsMat = lights.mat;
      disposables.push(
        boxes.mesh,
        boxes.geo,
        boxes.mat,
        pipes.mesh,
        pipes.geo,
        pipes.mat,
        lights.mesh,
        lights.geo,
        lights.mat,
      );
    }

    return {
      hull,
      hullMat,
      wingR,
      wingL,
      fin,
      plume,
      trail,
      canopyMat,
      boxGreebles,
      pipeGreebles,
      runLights,
      runLightsMat,
      dispose() {
        for (const d of disposables) d.dispose();
      },
    };
  }, [low]);

  // Free every custom resource when quality flips or the ship unmounts, and
  // keep the frame loop's material ref pointing at the current running lights.
  useEffect(() => {
    runLightsMatRef.current = geo.runLightsMat;
    return () => geo.dispose();
  }, [geo]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;

    const dt = Math.min(delta, 0.05);
    const reduced = flightState.reducedMotion;
    const flying = useSiteStore.getState().isFlying;
    const time = sceneTime();

    // Position: follow the anchor, add a gentle idle bob/drift when docked.
    g.position.copy(flightState.shipPosition);
    if (!reduced && !flying) {
      g.position.y += Math.sin(time * 1.1 + bobPhase.current) * 0.06;
      g.position.x += Math.sin(time * 0.7 + bobPhase.current) * 0.03;
    }

    // Orientation: point the nose (+Z) along the travel/facing direction, then
    // bank into the turn. Slerp so heading changes stay smooth and weighty.
    _fwd.copy(flightState.shipForward);
    if (_fwd.lengthSq() > 1e-8) {
      _fwd.normalize();
      const up = Math.abs(_fwd.y) > 0.99 ? _altUp : _up;
      _mat.lookAt(_fwd, _origin, up); // +Z basis becomes `_fwd`
      _qTarget.setFromRotationMatrix(_mat);

      roll.current = reduced
        ? 0
        : THREE.MathUtils.damp(roll.current, flightState.bank, 6, dt);
      _qRoll.setFromAxisAngle(_zAxis, roll.current);
      _qTarget.multiply(_qRoll);

      // Snap orientation under reduced motion, otherwise slerp for weighty turns.
      g.quaternion.slerp(_qTarget, reduced ? 1 : 1 - Math.exp(-9 * dt));
    }

    // Engine glow: ease toward the throttle target and drive the exhaust visuals.
    glow.current = reduced
      ? flightState.throttle
      : THREE.MathUtils.damp(glow.current, flightState.throttle, 5, dt);
    const t = glow.current;
    const flicker = reduced ? 1 : 0.9 + Math.sin(time * 30) * 0.1;

    const plume = plumeRef.current;
    if (plume) {
      plume.scale.set(0.55 + t * 0.5, 0.55 + t * 0.5, (0.5 + t * 1.7) * flicker);
      (plume.material as THREE.MeshBasicMaterial).opacity = (0.18 + t * 0.5) * flicker;
    }
    const core = coreRef.current;
    if (core) {
      core.scale.setScalar((0.6 + t * 0.7) * flicker);
      (core.material as THREE.MeshBasicMaterial).opacity = 0.35 + t * 0.55;
    }
    const trail = trailRef.current;
    if (trail) {
      trail.scale.set(0.5 + t * 0.4, 0.5 + t * 0.4, 1 + t * 3.2);
      (trail.material as THREE.MeshBasicMaterial).opacity = (0.05 + t * 0.16) * flicker;
    }

    // Gentle running-light pulse (allocation-free single material write).
    const rl = runLightsMatRef.current;
    if (rl) {
      rl.emissiveIntensity = reduced ? 2.6 : 2.4 + Math.sin(time * 3) * 0.7;
    }
  });

  return (
    <group ref={group}>
      {/* Revolved, panel-lined hull: pointed nose, swelling belly, tapered tail. */}
      <mesh geometry={geo.hull} material={geo.hullMat} />

      {/* Swept wings — bevelled extrusions, mirrored across the centreline. */}
      <mesh geometry={geo.wingR} position={[0, -0.02, 0]}>
        <meshStandardMaterial
          color={HULL_DARK}
          metalness={0.86}
          roughness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={geo.wingL} position={[0, -0.02, 0]}>
        <meshStandardMaterial
          color={HULL_DARK}
          metalness={0.86}
          roughness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Cyan leading-edge strips on the wings (lifted just proud of the foil). */}
      <mesh position={[0.52, 0.02, -0.12]} rotation={[0, -0.5, 0]}>
        <boxGeometry args={[0.6, 0.012, 0.02]} />
        <meshStandardMaterial
          color={CYAN}
          emissive={CYAN}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[-0.52, 0.02, -0.12]} rotation={[0, 0.5, 0]}>
        <boxGeometry args={[0.6, 0.012, 0.02]} />
        <meshStandardMaterial
          color={CYAN}
          emissive={CYAN}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>

      {/* Dorsal fin: a wing stood upright on the spine. */}
      <mesh geometry={geo.fin} position={[0, 0.11, -0.24]} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial
          color={HULL_DARK}
          metalness={0.86}
          roughness={0.42}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Scattered greebles + pipework (instanced: dozens of parts, few draws). */}
      {geo.boxGreebles && <primitive object={geo.boxGreebles} dispose={null} />}
      {geo.pipeGreebles && <primitive object={geo.pipeGreebles} dispose={null} />}

      {/* Row of running lights around the hull rim + wingtips. */}
      {geo.runLights && <primitive object={geo.runLights} dispose={null} />}

      {/* Cyan trim rings wrapping the fuselage. */}
      <mesh position={[0, 0, 0.16]}>
        <torusGeometry args={[0.246, 0.012, 8, low ? 16 : 28]} />
        <meshStandardMaterial
          color={CYAN}
          emissive={CYAN}
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, -0.28]}>
        <torusGeometry args={[0.268, 0.012, 8, low ? 16 : 28]} />
        <meshStandardMaterial
          color={CYAN}
          emissive={CYAN}
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>

      {/* Dorsal accent stripe along the spine. */}
      <mesh position={[0, 0.238, -0.06]}>
        <boxGeometry args={[0.03, 0.02, 0.5]} />
        <meshStandardMaterial
          color={CYAN}
          emissive={CYAN}
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>

      {/* Glowing belly vents — the reference's bright underside. Seated just
          proud of the radially-symmetric hull bottom so they read from below. */}
      <mesh position={[0, -0.295, -0.18]}>
        <boxGeometry args={[0.13, 0.03, 0.44]} />
        <meshStandardMaterial
          color="#052a32"
          emissive={CYAN}
          emissiveIntensity={1.7}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, -0.24, 0.34]}>
        <boxGeometry args={[0.1, 0.03, 0.22]} />
        <meshStandardMaterial
          color="#052a32"
          emissive={CYAN}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>

      {/* Cockpit canopy near the nose — glass-like clearcoat over a dark tint. */}
      <mesh position={[0, 0.12, 0.42]} rotation={[0.5, 0, 0]} material={geo.canopyMat}>
        <sphereGeometry
          args={[0.14, low ? 12 : 20, low ? 8 : 12, 0, Math.PI * 2, 0, Math.PI / 2]}
        />
      </mesh>

      {/* Engine housing shroud around the exhaust. */}
      <mesh position={[0, 0, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.185, 0.15, 0.2, low ? 12 : 24, 1, true]} />
        <meshStandardMaterial
          color={HULL_DARK}
          metalness={0.88}
          roughness={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Emissive nozzle rings around the exhaust mouth. */}
      <mesh position={[0, 0, -0.9]}>
        <torusGeometry args={[0.12, 0.02, 8, low ? 14 : 24]} />
        <meshStandardMaterial
          color={CYAN}
          emissive={CYAN}
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, -0.84]}>
        <torusGeometry args={[0.155, 0.014, 8, low ? 14 : 24]} />
        <meshStandardMaterial
          color={CYAN}
          emissive={CYAN}
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>

      {/* Bright additive engine core that surges with throttle. */}
      <mesh ref={coreRef} position={[0, 0, -0.94]}>
        <sphereGeometry args={[0.12, low ? 10 : 16, low ? 10 : 16]} />
        <meshBasicMaterial
          color={CYAN_BRIGHT}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Additive plume that stretches out the back as the engine spools up. */}
      <mesh ref={plumeRef} geometry={geo.plume} position={[0, 0, -0.92]}>
        <meshBasicMaterial
          color={CYAN}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Soft tapering after-trail (high quality only). */}
      {geo.trail && (
        <mesh ref={trailRef} geometry={geo.trail} position={[0, 0, -0.98]}>
          <meshBasicMaterial
            color={CYAN_BRIGHT}
            transparent
            opacity={0.16}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}
