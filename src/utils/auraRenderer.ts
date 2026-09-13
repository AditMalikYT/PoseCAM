/* ============================================================================
   AuraRenderer — real-time Three.js cosmetic FX on the live skeleton.
   ----------------------------------------------------------------------------
   Attaches additive point-cloud emitters to MediaPipe landmark anchors:
     · orbit rings      — lazy glow ring around the torso core
     · swarms           — drifting violet/cyan plasma clouds
     · chest glow       — flares hard at the bottom of a rep (depth-scaled)
     · trails           — comet tails flowing behind wrists/elbows
     · nodes            — accessory jewels pinned to individual joints
   Every frame App feeds in the latest landmarks + rep phase; this module
   writes positions/sizes/alpha straight into preallocated GPU buffers, so
   it never causes GC pressure in the 30fps camera loop.
============================================================================ */
import * as THREE from 'three';
import type { AuraVisual, AccessoryVisual } from '../types/cosmetics';
import type { PoseLandmark } from '../types/pose';

export interface AuraRendererConfig {
  aura?: AuraVisual | null;
  accessory?: AccessoryVisual | null;
}

type EmitterMode = 'orbit' | 'swarm' | 'chest' | 'trail' | 'node';

const MIN_VISIBILITY = 0.45;

/* Shared shader: per-particle size (world px) + alpha, additive blend. */
const VERT_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (120.0 / max(0.35, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG_SHADER = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.06, d) * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

/* -------------------------------------------------------------------------- */
/* Per-emitter particle system                                                 */
/* -------------------------------------------------------------------------- */
interface EmitterSpec {
  mode: EmitterMode;
  count: number;
  color: number;
  sizeMin: number;
  sizeMax: number;
  radius: number;
  anchorJoints: number[];
  trailJoints: number[];
  /** History slots per trail joint. */
  trailSlots?: number;
  intensity: number;
}

class Emitter {
  readonly mode: EmitterMode;
  private count: number;
  private joints: number[];
  private trailJoints: number[];
  private trailSlots = 0;
  private radius: number;
  private sizeMin: number;
  private sizeMax: number;
  private intensity: number;

  private positions: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;
  private phaseA: Float32Array;
  private phaseB: Float32Array;
  private phaseC: Float32Array;
  private trailHist: Float32Array;
  private trailHeads: Int32Array;

  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  readonly points: THREE.Points;

  constructor(scene: THREE.Scene, spec: EmitterSpec) {
    this.mode = spec.mode;
    this.count = spec.count;
    this.joints = spec.anchorJoints;
    this.trailJoints = spec.trailJoints;
    this.trailSlots = Math.max(4, spec.trailSlots ?? 10);
    this.radius = Math.max(0.01, spec.radius);
    this.sizeMin = spec.sizeMin;
    this.sizeMax = spec.sizeMax;
    this.intensity = spec.intensity;

    this.positions = new Float32Array(spec.count * 3);
    this.sizes = new Float32Array(spec.count);
    this.alphas = new Float32Array(spec.count);
    this.phaseA = new Float32Array(spec.count);
    this.phaseB = new Float32Array(spec.count);
    this.phaseC = new Float32Array(spec.count);

    const trailStride = this.trailJoints.length * this.trailSlots * 3;
    this.trailHist = new Float32Array(Math.max(3, trailStride));
    this.trailHeads = new Int32Array(Math.max(1, this.trailJoints.length));

    for (let i = 0; i < spec.count; i++) {
      this.phaseA[i] = Math.random() * Math.PI * 2;
      this.phaseB[i] = Math.random() * Math.PI * 2;
      this.phaseC[i] = Math.random() * Math.PI * 2;
      this.sizes[i] = 0;
      this.alphas[i] = 0;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT_SHADER,
      fragmentShader: FRAG_SHADER,
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uColor: { value: new THREE.Color(spec.color) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  /**
   * Recompute all particle positions. Called once per pose frame.
   * `depthFactor` (0..1) scales chest-glow flair at the bottom of a rep,
   * which is fed from the rep state machine phase.
   */
  update(
    landmarks: PoseLandmark[],
    toWorld: (lm: PoseLandmark) => { x: number; y: number; z: number } | null,
    now: number,
    depthFactor: number,
    dt: number
  ): void {
    switch (this.mode) {
      case 'orbit':
        this.updateOrbit(landmarks, toWorld, now, dt);
        break;
      case 'swarm':
        this.updateSwarm(landmarks, toWorld, now, dt, false, 0);
        break;
      case 'chest':
        this.updateSwarm(landmarks, toWorld, now, dt, true, depthFactor);
        break;
      case 'trail':
        this.updateTrail(landmarks, toWorld, now, dt);
        break;
      case 'node':
        this.updateNodes(landmarks, toWorld, now);
        break;
    }

    // Global intensity gate (per-emitter cost scaling)
    const kI = 0.18 + 0.82 * Math.min(1, Math.max(0.12, this.intensity));
    for (let i = 0; i < this.count; i++) {
      this.alphas[i] = Math.min(1, this.alphas[i] * kI);
    }

    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }

  /* ---- center-of-mass anchor from shoulder/hip joints ------------------ */
  private anchorWorld(
    landmarks: PoseLandmark[],
    toWorld: (lm: PoseLandmark) => { x: number; y: number; z: number } | null
  ): { x: number; y: number; z: number } | null {
    let sx = 0, sy = 0, sz = 0, sh = 0;
    let hx = 0, hy = 0, hz = 0, hh = 0;
    for (const idx of this.joints) {
      const lm = landmarks[idx];
      if (!lm || lm.visibility < MIN_VISIBILITY) continue;
      const w = toWorld(lm);
      if (!w) continue;
      if (idx === 11 || idx === 12) { sx += w.x; sy += w.y; sz += w.z; sh++; }
      else if (idx === 23 || idx === 24) { hx += w.x; hy += w.y; hz += w.z; hh++; }
    }
    if (sh === 0 && hh === 0 && this.joints.length > 0) {
      const lm = landmarks[this.joints[0]];
      const w = lm ? toWorld(lm) : null;
      if (w) return w;
      return null;
    }
    const hasS = sh > 0;
    const hasH = hh > 0;
    if (!hasS && !hasH) return null;
    const sx2 = hasS ? sx / sh : (hasH ? hx / hh : 0);
    const sy2 = hasS ? sy / sh : (hasH ? hy / hh : 0);
    const sz2 = hasS ? sz / sh : (hasH ? hz / hh : 0);
    const hx2 = hasH ? hx / hh : sx2;
    const hy2 = hasH ? hy / hh : sy2;
    const hz2 = hasH ? hz / hh : sz2;
    // Torso anchor biased toward the shoulders (chest line for push-ups)
    return { x: sx2 * 0.58 + hx2 * 0.42, y: sy2 * 0.58 + hy2 * 0.42, z: sz2 * 0.58 + hz2 * 0.42 };
  }

  private updateOrbit(
    landmarks: PoseLandmark[],
    toWorld: (lm: PoseLandmark) => { x: number; y: number; z: number } | null,
    t: number,
    _dt: number
  ): void {
    const a = this.anchorWorld(landmarks, toWorld);
    const n = this.count;
    for (let i = 0; i < n; i++) {
      if (!a) { this.sizes[i] = 0; this.alphas[i] = 0; continue; }
      const wave = 0.5 + 0.5 * Math.sin(t * 0.9 + i);
      const rad = this.radius * (0.86 + 0.22 * wave);
      const ang = t * (0.55 + 0.12 * Math.sin(i * 0.7)) + this.phaseA[i];
      const y = Math.sin(t * 1.4 + this.phaseB[i]) * 0.1 - 0.04;
      this.positions[i * 3] = a.x + Math.cos(ang) * rad;
      this.positions[i * 3 + 1] = a.y + y + Math.sin(t * 2.1 + i) * 0.03;
      this.positions[i * 3 + 2] = a.z + Math.sin(ang) * rad;
      this.sizes[i] = this.sizeMin + (this.sizeMax - this.sizeMin) * (0.4 + 0.6 * wave);
      this.alphas[i] = 0.32 + 0.5 * wave;
    }
  }

  private updateSwarm(
    landmarks: PoseLandmark[],
    toWorld: (lm: PoseLandmark) => { x: number; y: number; z: number } | null,
    t: number,
    _dt: number,
    chest = false,
    depthFactor = 0
  ): void {
    const a = this.anchorWorld(landmarks, toWorld);
    const n = this.count;
    const amp = chest ? this.radius * (0.2 + 1.6 * depthFactor) : this.radius;
    for (let i = 0; i < n; i++) {
      if (!a) { this.sizes[i] = 0; this.alphas[i] = 0; continue; }
      const breathing = 0.75 + 0.25 * Math.sin(t * 1.3 + this.phaseA[i]);
      if (chest) {
        this.positions[i * 3] = a.x + Math.sin(t * 1.5 + this.phaseA[i]) * amp + Math.sin(t * 3.7 + i) * 0.02;
        this.positions[i * 3 + 1] = a.y + Math.cos(t * 0.9 + this.phaseB[i]) * amp * 0.8;
        this.positions[i * 3 + 2] = a.z + Math.sin(t * 1.15 + this.phaseC[i]) * amp * 0.55;
        this.sizes[i] = this.sizeMin + (this.sizeMax - this.sizeMin) * (0.5 + 0.5 * depthFactor) * breathing;
        this.alphas[i] = (0.3 + 0.6 * depthFactor + 0.22 * Math.sin(t * 2.6 + i)) * breathing;
      } else {
        this.positions[i * 3] = a.x + Math.sin(t * 0.9 + this.phaseA[i]) * amp * breathing;
        this.positions[i * 3 + 1] = a.y + Math.cos(t * 1.3 + this.phaseB[i]) * amp * 0.85;
        this.positions[i * 3 + 2] = a.z + Math.sin(t * 1.1 + this.phaseC[i]) * amp * 0.45;
        this.sizes[i] = this.sizeMin + (this.sizeMax - this.sizeMin) * breathing;
        this.alphas[i] = (0.28 + 0.42 * breathing) * (0.5 + 0.5 * Math.sin(t * 2.2 + i));
      }
    }
  }

  private updateTrail(
    landmarks: PoseLandmark[],
    toWorld: (lm: PoseLandmark) => { x: number; y: number; z: number } | null,
    t: number,
    _dt: number
  ): void {
    const n = this.count;
    const jc = this.trailJoints.length;
    const slots = this.trailSlots;
    // Write the freshest position per joint into its ring slot
    for (let j = 0; j < jc; j++) {
      const lm = landmarks[this.trailJoints[j]];
      const w = lm && lm.visibility >= MIN_VISIBILITY ? toWorld(lm) : null;
      if (!w) continue;
      const head = this.trailHeads[j] % slots;
      const o = (j * slots + head) * 3;
      this.trailHist[o] = w.x;
      this.trailHist[o + 1] = w.y;
      this.trailHist[o + 2] = w.z;
      this.trailHeads[j] = (this.trailHeads[j] + 1) % slots;
    }
    const perJoint = Math.floor(n / jc) || 1;
    for (let p = 0; p < n; p++) {
      const j = p % jc;
      const k = Math.floor(p / jc);
      const slot = ((this.trailHeads[j] - k - 1 + slots * 2) % slots + slots) % slots;
      const hx = this.trailHist[(j * slots + slot) * 3];
      const hy = this.trailHist[(j * slots + slot) * 3 + 1];
      const hz = this.trailHist[(j * slots + slot) * 3 + 2];
      const fresh = hx === 0 && hy === 0 && hz === 0;
      if (fresh) { this.sizes[p] = 0; this.alphas[p] = 0; continue; }
      const tail = 1 - k / perJoint;
      const wob = Math.sin(t * 6 + p) * 0.012;
      this.positions[p * 3] = hx + wob;
      this.positions[p * 3 + 1] = hy + Math.sin(t * 8 + p * 1.3) * 0.008;
      this.positions[p * 3 + 2] = hz + wob;
      this.sizes[p] = (this.sizeMin + (this.sizeMax - this.sizeMin) * tail) * (0.6 + 0.4 * Math.sin(t * 10 + p));
      this.alphas[p] = 0.75 * tail * (0.5 + 0.5 * Math.sin(t * 11 + p));
    }
  }

  private updateNodes(
    landmarks: PoseLandmark[],
    toWorld: (lm: PoseLandmark) => { x: number; y: number; z: number } | null,
    t: number
  ): void {
    const n = this.count;
    const jc = this.joints.length || 1;
    const per = Math.max(1, Math.floor(n / jc));
    for (let p = 0; p < n; p++) {
      const j = p % jc;
      const k = p % per;
      const lm = landmarks[this.joints[j]];
      const w = lm && lm.visibility >= MIN_VISIBILITY ? toWorld(lm) : null;
      if (!w) { this.sizes[p] = 0; this.alphas[p] = 0; continue; }
      const ring = Math.sin(t * 2.4 + p);
      this.positions[p * 3] = w.x + Math.sin(t * 3 + p * 1.7) * 0.028 * k;
      this.positions[p * 3 + 1] = w.y + Math.cos(t * 2.7 + p * 1.1) * 0.024 * k;
      this.positions[p * 3 + 2] = w.z + ring * 0.02;
      this.sizes[p] = this.sizeMin + (this.sizeMax - this.sizeMin) * (0.5 + 0.5 * Math.sin(t * 4 + p));
      this.alphas[p] = 0.5 + 0.5 * Math.sin(t * 5 + p * 0.7);
    }
  }

  setColor(hex: number): void {
    (this.material.uniforms.uColor.value as THREE.Color).setHex(hex);
  }
}

/* -------------------------------------------------------------------------- */
/* AuraRenderer facade                                                         */
/* -------------------------------------------------------------------------- */
export class AuraRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private group = new THREE.Group();
  private emitters: Emitter[] = [];
  private config: AuraRendererConfig | null = null;
  private enabled = true;
  private lastPhase = 0;
  private running = false;
  private acc = 0;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.group.visible = this.enabled;
    scene.add(this.group);
  }

  setConfig(config: AuraRendererConfig | null): void {
    this.config = config;
    this.rebuild();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.group.visible = on;
  }

  get hasFX(): boolean {
    return this.emitters.length > 0;
  }

  dispose(): void {
    for (const e of this.emitters) e.dispose();
    this.emitters = [];
  }

  private rebuild(): void {
    for (const e of this.emitters) e.dispose();
    this.emitters = [];
    const cfg = this.config;
    if (!cfg || (!cfg.aura && !cfg.accessory)) return;

    if (cfg.aura) {
      const aura = cfg.aura;
      const color = parseInt(aura.color.replace('#', ''), 16);
      const count = Math.min(420, Math.max(12, Math.round(aura.particleCount)));
      if (aura.mode === 'trail') {
        this.emitters.push(
          new Emitter(this.scene, {
            mode: 'trail',
            count,
            color,
            sizeMin: 0.006,
            sizeMax: 0.05,
            radius: (aura.ringRadius ?? 0.55) * 1.4,
            anchorJoints: [],
            trailJoints: aura.trailJoints ?? [15, 16],
            trailSlots: Math.max(8, Math.round(count / Math.max(1, (aura.trailJoints ?? [15, 16]).length) / 2)),
            intensity: aura.intensity,
          })
        );
        if ((aura.anchorJoints ?? []).length && (aura.ringRadius ?? 0) > 0) {
          this.emitters.push(
            new Emitter(this.scene, {
              mode: 'orbit',
              count: Math.min(120, Math.round(count * 0.45)),
              color,
              sizeMin: 0.008,
              sizeMax: 0.035,
              radius: aura.ringRadius ?? 0.55,
              anchorJoints: aura.anchorJoints ?? [],
              trailJoints: [],
              intensity: aura.intensity,
            })
          );
        }
      } else if (aura.mode === 'chest-glow') {
        this.emitters.push(
          new Emitter(this.scene, {
            mode: 'chest',
            count,
            color,
            sizeMin: 0.008,
            sizeMax: 0.085,
            radius: 0.16,
            anchorJoints: aura.anchorJoints ?? [],
            trailJoints: [],
            intensity: aura.intensity,
          })
        );
      } else if (aura.mode === 'swarm') {
        this.emitters.push(
          new Emitter(this.scene, {
            mode: 'swarm',
            count,
            color,
            sizeMin: 0.006,
            sizeMax: 0.05,
            radius: aura.ringRadius ?? 0.55,
            anchorJoints: aura.anchorJoints ?? [11, 12, 23, 24],
            trailJoints: [],
            intensity: aura.intensity,
          })
        );
      } else {
        this.emitters.push(
          new Emitter(this.scene, {
            mode: 'orbit',
            count,
            color,
            sizeMin: 0.006,
            sizeMax: 0.038,
            radius: aura.ringRadius ?? 0.42,
            anchorJoints: aura.anchorJoints ?? [11, 12, 23, 24],
            trailJoints: [],
            intensity: aura.intensity,
          })
        );
      }
    }

    if (cfg.accessory) {
      const acc = cfg.accessory;
      const color = parseInt(acc.color.replace('#', ''), 16);
      this.emitters.push(
        new Emitter(this.scene, {
          mode: acc.trail ? 'trail' : 'node',
          count: Math.min(160, Math.max(24, acc.joints.length * 14)),
          color,
          sizeMin: 0.005,
          sizeMax: acc.nodeSize * 2.8,
          radius: 0.05,
          anchorJoints: acc.joints,
          trailJoints: acc.joints,
          trailSlots: 12,
          intensity: 1,
        })
      );
    }
  }

  /** Depth factor (0..1) drives the chest-glow flare at the bottom of a rep. */
  private depthFactorForPhase(phase: string): number {
    switch (phase) {
      case 'bottom': return 1;
      case 'ascent':
      case 'descent': return 0.55;
      case 'pulling':
      case 'lowering': return 0.65;
      default: return 0.15;
    }
  }

  /**
   * Called from the pose loop every detected frame.
   * `phase` — current rep phase string from the FSM ('bottom', 'ascent' ...)
   */
  update(landmarks: PoseLandmark[], phase: string, now: number, delta: number): void {
    if (!this.enabled || !this.config || this.emitters.length === 0) return;

    this.lastPhase = phase === 'bottom' ? 1 : 0;
    this.running = true;
    this.acc = Math.min(0.5, this.acc + (delta || 0.016));

    const toWorld = this.getToWorld();
    const depth = this.depthFactorForPhase(phase);
    const dt = delta;

    for (const em of this.emitters) em.update(landmarks, toWorld, now, depth, dt);
  }

  private getToWorld(): (lm: PoseLandmark) => { x: number; y: number; z: number } | null {
    const aspect = this.camera.aspect || 1.6;
    const halfH = 1.55;
    const halfW = halfH * aspect;
    const camY = this.camera.position.y;
    return (lm: PoseLandmark) => {
      if (lm.visibility < MIN_VISIBILITY) return null;
      return {
        x: (lm.x * 2 - 1) * halfW,
        // Landmarks are image-down; invert so screen-up maps to camera-up
        y: camY + (0.5 - lm.y) * 2 * halfH,
        z: -2,
      };
    };
  }
}

/** Convenience: rank the total FX load (for optional quality scaling). */
export function estimateFxLoad(cfg: AuraRendererConfig | null): number {
  let load = 0;
  if (cfg?.aura) load += cfg.aura.particleCount;
  if (cfg?.accessory) load += cfg.accessory.joints.length * 14;
  return load;
}