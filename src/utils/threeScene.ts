import * as THREE from 'three';
import particleVertShader from '../shaders/particleVert.glsl?raw';
import particleFragShader from '../shaders/particleFrag.glsl?raw';

export interface ThreeSceneSetup {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  xrButton: HTMLElement | null;
  xrSupported: boolean;
  lights: {
    ambient: THREE.AmbientLight;
    directional: THREE.DirectionalLight;
    point: THREE.PointLight;
  };
  spawnParticleBurst: (position?: THREE.Vector3, color?: number, count?: number) => void;
  spawnFloatingText: (text: string, position?: THREE.Vector3, color?: number) => void;
  updateFX: (delta: number) => void;
}

interface ActiveFloatingText {
  sprite: THREE.Sprite;
  life: number;
  maxLife: number;
}

export async function setupThreeScene(): Promise<ThreeSceneSetup> {
  const scene = new THREE.Scene();
  scene.background = null; // Transparent background for AR video overlay

  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    100
  );
  camera.position.set(0, 1.6, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.xr.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const container = document.getElementById('ar-container') || document.body;
  container.appendChild(renderer.domElement);

  // WebXR feature detection — silent check, no warning banners
  let xrSupported = false;

  try {
    if (navigator.xr) {
      xrSupported = await navigator.xr.isSessionSupported('immersive-ar');
    }
  } catch {
    xrSupported = false;
  }

  // Compact unobtrusive XR button — only rendered when AR is supported
  let xrButton: HTMLElement | null = null;

  if (xrSupported) {
    xrButton = document.createElement('button');
    xrButton.textContent = '🥽';
    xrButton.setAttribute('aria-label', 'Enter AR mode');
    xrButton.style.cssText = [
      'position:absolute',
      'bottom:16px',
      'right:16px',
      'z-index:100',
      'width:44px',
      'height:44px',
      'border-radius:50%',
      'border:2px solid rgba(0,243,255,0.5)',
      'background:rgba(16,20,38,0.7)',
      'color:#00f3ff',
      'font-size:1.2rem',
      'cursor:pointer',
      'backdrop-filter:blur(12px)',
      'box-shadow:0 0 15px rgba(0,243,255,0.2)',
      'transition:all .3s ease',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');
    xrButton.addEventListener('click', async () => {
      try {
        const session = await navigator.xr!.requestSession('immersive-ar', {
          requiredFeatures: ['local'],
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
          domOverlay: { root: document.body },
        });
        await renderer.xr.setSession(session);
        xrButton!.textContent = '✓';
        xrButton!.style.borderColor = '#00ff88';
        xrButton!.style.color = '#00ff88';
      } catch (err) {
        console.warn('[WebXR] AR session failed:', err);
        xrButton!.textContent = '✕';
        xrButton!.style.borderColor = '#ff2a6d';
        xrButton!.style.color = '#ff2a6d';
        setTimeout(() => {
          if (xrButton) {
            xrButton.textContent = '🥽';
            xrButton.style.borderColor = 'rgba(0,243,255,0.5)';
            xrButton.style.color = '#00f3ff';
          }
        }, 2000);
      }
    });
    document.body.appendChild(xrButton);
  }

  // Expose XR support flag for React state synchronization
  (window as any).__xrSupported = xrSupported;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0x00f3ff, 1.5);
  directionalLight.position.set(5, 10, 7);
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(0xff007a, 1, 10);
  pointLight.position.set(0, 2, -2);
  scene.add(pointLight);

  // --- PARTICLE BURST POOL SYSTEM ---
  const MAX_PARTICLES = 120;
  const particlePositions = new Float32Array(MAX_PARTICLES * 3);
  const particleVelocities = new Float32Array(MAX_PARTICLES * 3);
  const particleSizes = new Float32Array(MAX_PARTICLES);

  for (let i = 0; i < MAX_PARTICLES; i++) {
    particleSizes[i] = Math.random() * 0.15 + 0.05;
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('aVelocity', new THREE.BufferAttribute(particleVelocities, 3));
  particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(particleSizes, 1));

  const particleMaterial = new THREE.ShaderMaterial({
    vertexShader: particleVertShader,
    fragmentShader: particleFragShader,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 1.0 },
      uLifetime: { value: 1.2 },
      uAge: { value: 0 },
      uColor: { value: new THREE.Color(0x00f3ff) },
      uGlowIntensity: { value: 2.0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const particleMesh = new THREE.Points(particleGeometry, particleMaterial);
  particleMesh.visible = false;
  scene.add(particleMesh);

  let particleAge = 0;
  let isParticleActive = false;

  const spawnParticleBurst = (
    pos: THREE.Vector3 = new THREE.Vector3(0, 1.5, -2),
    colorHex: number = 0x00f3ff,
    count: number = 60
  ) => {
    particleMaterial.uniforms.uColor.value.setHex(colorHex);
    particleMaterial.uniforms.uAge.value = 0;
    particleAge = 0;
    isParticleActive = true;

    const posAttr = particleGeometry.attributes.position as THREE.BufferAttribute;
    const velAttr = particleGeometry.attributes.aVelocity as THREE.BufferAttribute;

    const spawnCount = Math.min(count, MAX_PARTICLES);
    for (let i = 0; i < spawnCount; i++) {
      posAttr.setXYZ(i, pos.x, pos.y, pos.z);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI - Math.PI / 2;
      const speed = Math.random() * 1.5 + 0.5;

      velAttr.setXYZ(
        i,
        Math.cos(theta) * Math.cos(phi) * speed,
        Math.sin(phi) * speed + 0.5,
        Math.sin(theta) * Math.cos(phi) * speed
      );
    }

    posAttr.needsUpdate = true;
    velAttr.needsUpdate = true;
    particleMesh.visible = true;
  };

  // --- FLOATING SPRITE TEXT SYSTEM ---
  const activeTexts: ActiveFloatingText[] = [];

  const spawnFloatingText = (
    text: string,
    pos: THREE.Vector3 = new THREE.Vector3(0, 1.8, -2),
    color: number = 0x00ff88
  ) => {
    const sprite = createFloatingText(text, color, 0.6);
    sprite.position.copy(pos);
    scene.add(sprite);
    activeTexts.push({ sprite, life: 0, maxLife: 1.2 });
  };

  // FX animation loop update
  const updateFX = (delta: number) => {
    if (isParticleActive) {
      particleAge += delta;
      particleMaterial.uniforms.uAge.value = particleAge;
      if (particleAge >= 1.2) {
        isParticleActive = false;
        particleMesh.visible = false;
      }
    }

    for (let i = activeTexts.length - 1; i >= 0; i--) {
      const item = activeTexts[i];
      item.life += delta;
      item.sprite.position.y += delta * 0.4;
      const progress = item.life / item.maxLife;

      if (item.sprite.material instanceof THREE.SpriteMaterial) {
        item.sprite.material.opacity = Math.max(0, 1 - progress);
      }

      if (item.life >= item.maxLife) {
        scene.remove(item.sprite);
        item.sprite.material.map?.dispose();
        item.sprite.material.dispose();
        activeTexts.splice(i, 1);
      }
    }
  };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    scene,
    camera,
    renderer,
    xrButton,
    xrSupported,
    lights: {
      ambient: ambientLight,
      directional: directionalLight,
      point: pointLight,
    },
    spawnParticleBurst,
    spawnFloatingText,
    updateFX,
  };
}

export function createFloatingText(
  text: string,
  color: number = 0x00ff88,
  size: number = 1
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(10, 14, 30, 0.75)';
  ctx.roundRect(16, 16, 480, 224, 24);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.stroke();

  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.font = '900 56px "Outfit", "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size * 1.6, size * 0.8, 1);
  return sprite;
}

export function disposeThreeScene(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer
): void {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Sprite) {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach((m) => m.dispose());
      } else {
        object.material?.dispose();
      }
    }
  });
  renderer.dispose();
  renderer.domElement.remove();
}
