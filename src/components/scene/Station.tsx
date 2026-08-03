"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { DESTINATIONS } from "@/lib/destinations";
import { useSiteStore } from "@/lib/store";
import {
  createPanelMaterial,
  makeRng,
  profileRadiusAt,
  type Disposable,
} from "./ShipDetail";

const HULL = "#aeb9c6";
const HULL_MID = "#7f8b98";
const PANEL = "#0e2b46";
const ACCENT = "#67e8f9";
const WINDOW = "#ffdca8";

/**
 * Hub silhouette as `[radius, axialHeight]` pairs (top first). Shared by the
 * lathe builder and the surface sampler so greebles sit on the true hull.
 */
const HUB_PROFILE: readonly [number, number][] = [
  [0.0, 0.58],
  [0.12, 0.52],
  [0.2, 0.4],
  [0.26, 0.22],
  [0.3, 0.0],
  [0.26, -0.22],
  [0.2, -0.4],
  [0.12, -0.52],
  [0.0, -0.58],
];

/** Reactive prefers-reduced-motion flag (client-only, SSR-safe default). */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * Revolve the rounded spindle silhouette around the lathe's Y axis for the
 * station's central hub — cleaner than a bare cylinder and it matches the
 * ship's crafted look.
 */
function buildHub(segments: number): THREE.LatheGeometry {
  const profile = HUB_PROFILE.map(([r, h]) => new THREE.Vector2(r, h));
  return new THREE.LatheGeometry(profile, segments);
}

/** Fill an InstancedMesh from a list of matrices and finalise its bounds. */
function finishInstanced(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  mats: THREE.Matrix4[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, mats.length);
  for (let i = 0; i < mats.length; i++) mesh.setMatrixAt(i, mats[i]);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * Scatter mechanical greebles across the vertical hub surface. One InstancedMesh
 * gives the hub the reference's built-up density for a single draw call.
 */
function buildHubGreebles(rng: () => number): {
  mesh: THREE.InstancedMesh;
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
} {
  const n = new THREE.Vector3();
  const t = new THREE.Vector3();
  const tNeg = new THREE.Vector3();
  const ax = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const mats: THREE.Matrix4[] = [];

  for (let i = 0; i < 30; i++) {
    const y = -0.5 + rng() * 1.0;
    const r = profileRadiusAt(HUB_PROFILE, y);
    if (r < 0.08) continue;
    const phi = rng() * Math.PI * 2;
    n.set(Math.cos(phi), 0, Math.sin(phi));
    t.set(-Math.sin(phi), 0, Math.cos(phi));
    const w = 0.05 + rng() * 0.08;
    const h = 0.05 + rng() * 0.12;
    const d = 0.02 + rng() * 0.05;
    scl.set(w, h, d);
    pos.set(n.x * (r + d * 0.35), y, n.z * (r + d * 0.35));
    // -t keeps the basis right-handed (-t × ax = n) so normals face outward.
    tNeg.copy(t).multiplyScalar(-1);
    m.makeBasis(tNeg, ax, n).scale(scl).setPosition(pos);
    mats.push(m.clone());
  }

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: HULL_MID,
    metalness: 0.7,
    roughness: 0.45,
  });
  return { mesh: finishInstanced(geo, mat, mats), geo, mat };
}

/**
 * Radial truss struts triangulating the habitation wheel: two rings of spokes
 * (hub -> mid, mid -> rim) as one InstancedMesh, giving the ring visible
 * structure without a mesh per strut.
 */
function buildTrussStruts(): {
  mesh: THREE.InstancedMesh;
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
} {
  const d = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tang = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const mats: THREE.Matrix4[] = [];

  const strut = (theta: number, a: number, b: number) => {
    d.set(Math.cos(theta), 0, Math.sin(theta));
    tang.set(-Math.sin(theta), 0, Math.cos(theta));
    const len = b - a;
    scl.set(len, 0.03, 0.03);
    pos.copy(d).multiplyScalar((a + b) / 2);
    m.makeBasis(d, up, tang).scale(scl).setPosition(pos);
    mats.push(m.clone());
  };

  const rings = 12;
  for (let i = 0; i < rings; i++) {
    const theta = (i / rings) * Math.PI * 2;
    strut(theta, 0.33, 0.66);
    strut(theta, 0.66, 1.0);
  }

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: HULL_MID,
    metalness: 0.6,
    roughness: 0.5,
  });
  return { mesh: finishInstanced(geo, mat, mats), geo, mat };
}

/** Lit cabin windows spaced around the habitation ring (one InstancedMesh). */
function buildWindows(): {
  mesh: THREE.InstancedMesh;
  geo: THREE.BufferGeometry;
  mat: THREE.MeshStandardMaterial;
} {
  const pos = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const mats: THREE.Matrix4[] = [];
  const count = 16;
  const r = 1.05;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pos.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    m.makeScale(0.06, 0.05, 0.06).setPosition(pos);
    mats.push(m.clone());
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: "#3a2f18",
    emissive: WINDOW,
    emissiveIntensity: 1.8,
  });
  mat.toneMapped = false;
  return { mesh: finishInstanced(geo, mat, mats), geo, mat };
}

/** Cyan running lights around the ring rim (one InstancedMesh, blooms). */
function buildRingLights(): {
  mesh: THREE.InstancedMesh;
  geo: THREE.BufferGeometry;
  mat: THREE.MeshStandardMaterial;
} {
  const pos = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const mats: THREE.Matrix4[] = [];
  const count = 28;
  const r = 1.16;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pos.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    m.makeScale(0.02, 0.02, 0.02).setPosition(pos);
    mats.push(m.clone());
  }
  const geo = new THREE.SphereGeometry(1, 8, 6);
  const mat = new THREE.MeshStandardMaterial({
    color: "#0a3a44",
    emissive: ACCENT,
    emissiveIntensity: 2.4,
  });
  mat.toneMapped = false;
  return { mesh: finishInstanced(geo, mat, mats), geo, mat };
}

/**
 * Home Station — the user's starting point. A revolved, panel-lined hub carries
 * a spinning habitation wheel (trussed ring + spokes, lit windows, running
 * lights) with cyan trim, flanked by solar arrays and an antenna mast. Clicking
 * it returns the ship to the station.
 */
export function Station() {
  const station = DESTINATIONS.station;
  const quality = useSiteStore((s) => s.quality);
  const returnToStation = useSiteStore((s) => s.returnToStation);
  const reduced = usePrefersReducedMotion();

  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const low = quality === "low";
  const ringTubular = low ? 16 : 40;
  const ringRadial = low ? 6 : 12;
  const cylSeg = low ? 8 : 20;

  // Build every custom geometry, material and instanced set once per quality.
  const detail = useMemo(() => {
    const hubSeg = low ? 16 : 36;

    const hub = buildHub(hubSeg);
    const hubMat = createPanelMaterial({
      color: HULL,
      metalness: 0.72,
      roughness: 0.3,
      uLines: 14,
      vLines: 7,
      seamStrength: 0.42,
      plateStrength: 0.13,
      lineWidth: 0.03,
      seed: 7,
    });
    const solarMat = createPanelMaterial({
      color: PANEL,
      metalness: 0.35,
      roughness: 0.5,
      emissive: "#0a2740",
      emissiveIntensity: 0.35,
      uLines: 14,
      vLines: 8,
      seamStrength: 0.7,
      plateStrength: 0.1,
      lineWidth: 0.018,
      seed: 11,
    });

    const disposables: Disposable[] = [hub, hubMat, solarMat];

    let hubGreebles: THREE.InstancedMesh | null = null;
    let struts: THREE.InstancedMesh | null = null;
    let windows: THREE.InstancedMesh | null = null;
    let runLights: THREE.InstancedMesh | null = null;

    if (!low) {
      const rng = makeRng(0x5eed1234);
      const g = buildHubGreebles(rng);
      const s = buildTrussStruts();
      const w = buildWindows();
      const l = buildRingLights();
      hubGreebles = g.mesh;
      struts = s.mesh;
      windows = w.mesh;
      runLights = l.mesh;
      disposables.push(
        g.mesh,
        g.geo,
        g.mat,
        s.mesh,
        s.geo,
        s.mat,
        w.mesh,
        w.geo,
        w.mat,
        l.mesh,
        l.geo,
        l.mat,
      );
    }

    return {
      hub,
      hubMat,
      solarMat,
      hubGreebles,
      struts,
      windows,
      runLights,
      dispose() {
        for (const d of disposables) d.dispose();
      },
    };
  }, [low]);

  // Restore the cursor on unmount.
  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
    };
  }, []);

  // Free every custom resource when quality flips or the station unmounts.
  useEffect(() => {
    return () => detail.dispose();
  }, [detail]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    if (!reduced) g.rotation.y += delta * 0.05;
    const target = hovered ? 1.06 : 1;
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, target, 6, delta));
    const ring = ringRef.current;
    if (ring && !reduced) ring.rotation.y += delta * 0.3;
  });

  const accent = station.color;

  return (
    <group ref={groupRef} position={station.position}>
      {/* Invisible interaction proxy: one stable hit target for the whole
          station so the cursor never flickers between child meshes. */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          returnToStation();
        }}
      >
        <sphereGeometry args={[2, 12, 12]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>

      {/* Central hub (revolved, panel-lined spindle) */}
      <mesh geometry={detail.hub} material={detail.hubMat} />

      {/* Hub greebles (instanced) */}
      {detail.hubGreebles && <primitive object={detail.hubGreebles} dispose={null} />}

      {/* Emissive collar band around the hub waist */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.31, 0.02, 6, low ? 16 : 28]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>

      {/* Rotating habitation wheel: ring + trusses + spokes + trim spin as one. */}
      <group ref={ringRef}>
        {/* Habitation ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.05, 0.1, ringRadial, ringTubular]} />
          <meshStandardMaterial color={HULL_MID} metalness={0.6} roughness={0.42} />
        </mesh>

        {/* Emissive accent trim on the ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.05, 0.035, 6, ringTubular]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>

        {/* Mid truss ring (high quality only) */}
        {!low && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.66, 0.02, 6, ringTubular]} />
            <meshStandardMaterial color={HULL_MID} metalness={0.6} roughness={0.5} />
          </mesh>
        )}

        {/* Radial truss struts (instanced, high quality only) */}
        {detail.struts && <primitive object={detail.struts} dispose={null} />}

        {/* Spokes from hub to ring (radial in the wheel plane) */}
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
            <mesh position={[0.66, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.045, 0.045, 0.78, cylSeg]} />
              <meshStandardMaterial color={HULL_MID} metalness={0.55} roughness={0.45} />
            </mesh>
          </group>
        ))}

        {/* Lit cabin windows (instanced, high quality only) */}
        {detail.windows && <primitive object={detail.windows} dispose={null} />}

        {/* Cyan running lights around the rim (instanced, high quality only) */}
        {detail.runLights && <primitive object={detail.runLights} dispose={null} />}
      </group>

      {/* Solar arrays on side arms — panel-lined for visible cell subdivision */}
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[0, 0, s * 1.05]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.7, cylSeg]} />
            <meshStandardMaterial color={HULL_MID} metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, s * 1.85]} material={detail.solarMat}>
            <boxGeometry args={[1.55, 0.02, 0.9]} />
          </mesh>
          {/* Cyan frame edge along the outer panel rib */}
          <mesh position={[0, 0.015, s * 1.85]}>
            <boxGeometry args={[1.57, 0.01, 0.05]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={1.2}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* Antenna mast with an emissive accent tip */}
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.7, low ? 6 : 10]} />
        <meshStandardMaterial color={HULL} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <sphereGeometry args={[0.08, low ? 8 : 12, low ? 8 : 12]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
