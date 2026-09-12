import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/* -------------------------------------------------------------------------- */
/* GuideSkeleton3D - interactive animated 3D stick figure for the Pose Guide  */
/* -------------------------------------------------------------------------- */
/* Renders a kinematic stick figure that loops a full rep of the selected     */
/* exercise. `variant="correct"` animates the ideal joint alignment;          */
/* `variant="fault"` animates the most common fault (hip sag for push-ups,    */
/* kipping for pull-ups) with the offending joints highlighted red.           */
/* Drag horizontally to orbit the camera.                                     */
/* -------------------------------------------------------------------------- */

export type GuideVariant = 'correct' | 'fault';

interface GuideSkeleton3DProps {
  exercise: 'pushups' | 'pullups';
  variant: GuideVariant;
}

/* Segment lengths (scene units) */
const L_UPPER = 0.32;
const L_FORE = 0.32;
const TORSO = 0.52;
const THIGH = 0.42;
const SHIN = 0.42;

const COLORS = {
  bone: 0x00f3ff,
  joint: 0x9de8ff,
  head: 0x9de8ff,
  fault: 0xff2a6d,
  bar: 0xffd700,
};

interface Skeleton {
  joints: Map<string, THREE.Mesh>;
  bones: Map<string, THREE.Mesh>;
}

/** Two-circle intersection: point at r1 from c1 and r2 from c2 (2D xy). */
function circleIntersect(
  c1: THREE.Vector2,
  c2: THREE.Vector2,
  r1: number,
  r2: number,
  preferLowX: boolean
): THREE.Vector2 | null {
  const d = c1.distanceTo(c2);
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) return null;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(r1 * r1 - a * a, 0));
  const dir = c2.clone().sub(c1).normalize();
  const mid = c1.clone().addScaledVector(dir, a);
  const perp = new THREE.Vector2(-dir.y, dir.x);
  const p1 = mid.clone().addScaledVector(perp, h);
  const p2 = mid.clone().addScaledVector(perp, -h);
  if (preferLowX ? p1.x < p2.x : p1.x > p2.x) return p1;
  return p2;
}

function buildSkeleton(root: THREE.Group): Skeleton {
  const joints = new Map<string, THREE.Mesh>();
  const bones = new Map<string, THREE.Mesh>();
  const jointNames = [
    'head', 'shoulderN', 'shoulderF', 'elbowN', 'elbowF', 'wristN', 'wristF',
    'hipN', 'hipF', 'kneeN', 'kneeF', 'ankleN', 'ankleF', 'shoulderMid', 'hipMid',
  ];
  const boneNames = [
    'spine', 'upperArmN', 'foreArmN', 'upperArmF', 'foreArmF',
    'thighN', 'shinN', 'thighF', 'shinF', 'neck',
  ];

  for (const name of jointNames) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(name === 'head' ? 0.115 : 0.05, 16, 12),
      new THREE.MeshStandardMaterial({
        color: name === 'head' ? COLORS.head : COLORS.joint,
        roughness: 0.35,
        emissive: 0x0a2a33,
      })
    );
    mesh.userData.baseColor = (mesh.material as THREE.MeshStandardMaterial).color.getHex();
    joints.set(name, mesh);
    root.add(mesh);
  }
  for (const name of boneNames) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(name === 'spine' ? 0.045 : 0.03, name === 'spine' ? 0.045 : 0.03, 1, 10),
      new THREE.MeshStandardMaterial({ color: COLORS.bone, roughness: 0.3, emissive: 0x08333a })
    );
    mesh.userData.baseColor = (mesh.material as THREE.MeshStandardMaterial).color.getHex();
    bones.set(name, mesh);
    root.add(mesh);
  }
  return { joints, bones };
}


const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function setBone(bone: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
  const dir = b.clone().sub(a);
  const len = Math.max(dir.length(), 1e-5);
  bone.position.copy(a).addScaledVector(dir, 0.5);
  bone.scale.set(1, len, 1);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  bone.quaternion.copy(quat);
}

export default function GuideSkeleton3D({ exercise, variant }: GuideSkeleton3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const variantRef = useRef(variant);
  variantRef.current = variant;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth || 480, mount.clientHeight || 360);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, (mount.clientWidth || 480) / (mount.clientHeight || 360), 0.1, 50);
    camera.position.set(0, 1.35, 3.4);
    camera.lookAt(0, 1.1, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0x9be7ff, 1.1);
    key.position.set(2, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff2a6d, 0.25);
    rim.position.set(-3, 1.5, -2);
    scene.add(rim);

    const grid = new THREE.GridHelper(6, 24, 0x0e4d5c, 0x0a2f3a);
    grid.position.y = -0.001;
    scene.add(grid);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 40),
      new THREE.MeshBasicMaterial({ color: 0x061520, transparent: true, opacity: 0.6 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Pull-up bar (hidden for push-up scenes)
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1.6, 12),
      new THREE.MeshStandardMaterial({ color: COLORS.bar, roughness: 0.4, emissive: 0x3d3000 })
    );
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 2.2, 0);
    const barGroup = new THREE.Group();
    barGroup.add(bar);
    scene.add(barGroup);

    const root = new THREE.Group();
    scene.add(root);
    const skeleton = buildSkeleton(root);

    const orbit = { yaw: 0, target: 0 };
    let dragging = false;
    let lastX = 0;

    const onPointerDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      orbit.target += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    };
    const onPointerUp = () => { dragging = false; };
    const el = renderer.domElement;
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    let raf = 0;
    const clock = new THREE.Clock();


    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const cycle = (Math.sin((t * Math.PI) / 1.6) + 1) / 2;
      const depth = cycle * cycle * (3 - 2 * cycle);
      orbit.yaw += (orbit.target - orbit.yaw) * 0.12;
      root.rotation.y = orbit.yaw;

      const fault = variantRef.current === 'fault';
      const j = skeleton.joints;
      const b = skeleton.bones;
      const faultNames = exercise === 'pushups'
        ? ['hipN', 'hipF', 'hipMid', 'spine']
        : ['kneeN', 'kneeF', 'ankleN', 'ankleF'];
      const isFaulted = (name: string) => fault && faultNames.includes(name);

      // Repaint materials (fault joints go red)
      for (const [name, mesh] of j) {
        (mesh.material as THREE.MeshStandardMaterial).color.setHex(
          isFaulted(name) ? COLORS.fault : Number(mesh.userData.baseColor)
        );
      }
      for (const [name, mesh] of b) {
        (mesh.material as THREE.MeshStandardMaterial).color.setHex(
          isFaulted(name) ? COLORS.fault : Number(mesh.userData.baseColor)
        );
      }

      const pts: Record<string, THREE.Vector3> = {};

      if (exercise === 'pushups') {
        barGroup.visible = false;
        const elbowDeg = 170 - (170 - 85) * depth;
        const elbowRad = (elbowDeg * Math.PI) / 180;
        // Shoulder descends as the elbow bends (wrists pinned to the floor)
        const dSW = Math.sqrt(L_UPPER ** 2 + L_FORE ** 2 - 2 * L_UPPER * L_FORE * Math.cos(elbowRad));
        const shoulderBase = V(0.72, dSW, 0);
        const ankle = V(-1.08, 0.05, 0);
        const line = ankle.clone().sub(shoulderBase);
        const sagDrop = fault ? 0.16 * depth : 0;
        const hipMid = shoulderBase.clone().addScaledVector(line, 0.46).add(V(0, -sagDrop, 0));
        const kneeMid = shoulderBase.clone().addScaledVector(line, 0.76);

        pts.shoulderN = V(shoulderBase.x, shoulderBase.y, 0.06);
        pts.shoulderF = V(shoulderBase.x, shoulderBase.y, -0.06);
        pts.wristN = V(0.78, 0.05, 0.09);
        pts.wristF = V(0.78, 0.05, -0.03);
        pts.hipN = V(hipMid.x, hipMid.y, 0.06);
        pts.hipF = V(hipMid.x, hipMid.y, -0.06);
        pts.kneeN = V(kneeMid.x, kneeMid.y, 0.06);
        pts.kneeF = V(kneeMid.x, kneeMid.y, -0.06);
        pts.ankleN = V(ankle.x, ankle.y, 0.07);
        pts.ankleF = V(ankle.x, ankle.y, -0.05);
        const elbowSolN = circleIntersect(
          new THREE.Vector2(pts.shoulderN.x, pts.shoulderN.y),
          new THREE.Vector2(pts.wristN.x, pts.wristN.y),
          L_UPPER, L_FORE, true
        );
        const elbowSolF = circleIntersect(
          new THREE.Vector2(pts.shoulderF.x, pts.shoulderF.y),
          new THREE.Vector2(pts.wristF.x, pts.wristF.y),
          L_UPPER, L_FORE, true
        );
        pts.elbowN = V(elbowSolN?.x ?? 0.55, elbowSolN?.y ?? dSW / 2, 0.09);
        pts.elbowF = V(elbowSolF?.x ?? 0.55, elbowSolF?.y ?? dSW / 2, -0.03);
        pts.shoulderMid = shoulderBase;
        pts.hipMid = hipMid;
        const headDir = shoulderBase.clone().sub(ankle).normalize();
        pts.head = shoulderBase.clone().addScaledVector(headDir, 0.2).add(V(0, 0.06, 0));
      } else {
        barGroup.visible = true;
        const elbowDeg = 170 - (170 - 50) * depth;
        const elbowRad = (elbowDeg * Math.PI) / 180;
        const dHS = Math.sqrt(L_UPPER ** 2 + L_FORE ** 2 - 2 * L_UPPER * L_FORE * Math.cos(elbowRad));
        const swing = fault ? Math.sin(t * 2.4) * 0.14 : 0;
        const shoulderY = 2.2 - dHS;
        const hipY = shoulderY - TORSO;
        const tuck = fault ? 0.34 * depth : 0;
        const chinClear = !fault && depth > 0.55;

        pts.shoulderN = V(-0.2 + swing, shoulderY, 0);
        pts.shoulderF = V(0.2 + swing, shoulderY, 0);
        pts.wristN = V(-0.26, 2.2, 0);
        pts.wristF = V(0.26, 2.2, 0);
        pts.hipN = V(-0.08 + swing * 1.6, hipY, 0);
        pts.hipF = V(0.08 + swing * 1.6, hipY, 0);
        pts.kneeN = V(-0.1 + swing * 1.9 + tuck * 0.5, hipY - THIGH * 0.92, tuck);
        pts.kneeF = V(0.1 + swing * 1.9 + tuck * 0.5, hipY - THIGH * 0.92, tuck);
        pts.ankleN = V(-0.12 + swing * 2.2 + tuck * 0.8, hipY - THIGH - SHIN * 0.94, tuck * 1.35);
        pts.ankleF = V(0.12 + swing * 2.2 + tuck * 0.8, hipY - THIGH - SHIN * 0.94, tuck * 1.35);
        const elbowSolN = circleIntersect(
          new THREE.Vector2(pts.shoulderN.x, pts.shoulderN.y),
          new THREE.Vector2(pts.wristN.x, pts.wristN.y),
          L_UPPER, L_FORE, true
        );
        const elbowSolF = circleIntersect(
          new THREE.Vector2(pts.shoulderF.x, pts.shoulderF.y),
          new THREE.Vector2(pts.wristF.x, pts.wristF.y),
          L_UPPER, L_FORE, false
        );
        pts.elbowN = V(elbowSolN?.x ?? -0.35, elbowSolN?.y ?? (shoulderY + 2.2) / 2, 0.02);
        pts.elbowF = V(elbowSolF?.x ?? 0.35, elbowSolF?.y ?? (shoulderY + 2.2) / 2, -0.02);
        pts.shoulderMid = V(swing, shoulderY, 0);
        pts.hipMid = V(swing * 1.6, hipY, 0);
        // Correct top: chin clears the bar; fault: head stays below bar
        pts.head = V(swing, shoulderY + (chinClear ? 0.24 : 0.17), chinClear ? 0.14 : 0.05);
      }

      for (const [name, p] of Object.entries(pts)) {
        j.get(name)?.position.copy(p);
      }
      setBone(b.get('spine')!, pts.shoulderMid, pts.hipMid);
      setBone(b.get('neck')!, pts.shoulderMid, pts.head);
      setBone(b.get('upperArmN')!, pts.shoulderN, pts.elbowN);
      setBone(b.get('foreArmN')!, pts.elbowN, pts.wristN);
      setBone(b.get('upperArmF')!, pts.shoulderF, pts.elbowF);
      setBone(b.get('foreArmF')!, pts.elbowF, pts.wristF);
      setBone(b.get('thighN')!, pts.hipN, pts.kneeN);
      setBone(b.get('shinN')!, pts.kneeN, pts.ankleN);
      setBone(b.get('thighF')!, pts.hipF, pts.kneeF);
      setBone(b.get('shinF')!, pts.kneeF, pts.ankleF);

      renderer.render(scene, camera);
    };
    animate();


    const onResize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      el.remove();
    };
  }, [exercise]);

  return <div ref={mountRef} className="guide-3d-mount" />;
}


