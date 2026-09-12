# AR Calisthenics Gamification System - Architecture Documentation

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AR CALISTHENICS APP                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────┐    ┌──────────────────┐    ┌─────────────────────────┐   │
│  │  Camera Feed  │───▶│  Pose Estimation │───▶│  Rep Detection Engine   │  │
│  │  (WebRTC/Media)│    │  (MediaPipe/TJS) │    │  (State Machine)        │  │
│  └───────────────┘    └──────────────────┘    └───────────┬─────────────┘   │
│                                                           │                │
│  ┌───────────────┐    ┌──────────────────┐               │                │
│  │  WebXR/Three  │◀───│   Game State     │◀──────────────┘                │
│  │  Scene Renderer│    │   Manager        │                                 │
│  └───────────────┘    └──────────────────┘    ┌─────────────────────────┐  │
│                                               │   Progression System     │  │
│  ┌───────────────┐                           │   (XP/Cosmetics/Streak) │  │
│  │   UI Overlay  │◀──────────────────────────└─────────────────────────┘  │
│  │   (HUD/Game)  │                                                         │
│  └───────────────┘                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Camera Pipeline & Pose Estimation Loop

### 1.1 Camera Initialization Sequence

The camera pipeline begins by requesting camera permission via `navigator.mediaDevices.getUserMedia()`, creating a video element for frame access. We configure resolution to 640x480 for optimal pose detection speed while maintaining accuracy. The video is mirrored horizontally for correct user orientation. A continuous `requestAnimationFrame` loop captures frames for real-time processing.

Key considerations:
- Use `facingMode: "user"` for selfie-style workout tracking
- Lower resolution = faster detection, trade-off with accuracy
- Apply video transform for correct coordinate system

### 1.2 Pose Estimation Integration (MediaPipe Pose)

MediaPipe Pose provides 33 keypoints including shoulders (11,12), elbows (13,14), wrists (15,16), hips (23,24), knees (25,26), and ankles (27,28). Configuration options include model complexity (1=fast, 2=balanced, 3=accurate), landmark smoothing for temporal stability, and confidence thresholds (minimum 0.5 for detection and tracking).
## 1.3 Frame Processing Loop

The frame processing loop captures video frames, flips them horizontally for mirror effect, passes them to the pose detection model, extracts 33 landmarks with confidence scores, filters landmarks by confidence threshold (>0.5), calculates joint angles from landmark vectors, feeds angles to the Rep Detection State Machine, updates game state if a rep is detected, and renders the AR scene with current state. This loop runs at approximately 30fps for real-time feedback.

## 2. Rep Detection State Machine

### 2.1 Push-Up Detection State Machine

The push-up detection uses a state machine with four main states:
- **IDLE**: Initial state waiting for user to start (angle > 160° at rest)
- **ECCENTRIC (Going Down)**: Transition occurs when angle drops below 160°, continues until bottom position (angle < 100°)
- **BOTTOM (Hold)**: Horse position at bottom, validates floor contact and holds briefly
- **CONCENTRIC (Going Up)**: Pushing up phase, completes when angle exceeds 140°-150°

A rep is counted when the full cycle completes: IDLE → ECCENTRIC → BOTTOM → CONCENTRIC → back to IDLE. Invalid transitions or form breaks reset the state and reject the rep.

### 2.2 Form Validation Logic

Form validation checks:
1. **Hips sagging detection**: Calculates hip-shoulder angle throughout movement; hips should remain straight (angle > 160°). Sagging breaks plank form.
2. **Range of motion validation**: Minimum elbow flexion should reach 90° (chest close to floor); maximum extension at top position. Partial reps (not reaching full depth) receive reduced XP.
3. **Speed/tempo consistency**: Eccentric phase should be controlled (1-3 seconds). Very fast drops may indicate poor control.
4. **Shoulder stability**: Shoulders should not collapse inward; track shoulder landmark position relative to ear.

## 3. WebXR Render Pipeline

### 3.1 Scene Graph Structure

The Three.js scene graph includes:
- **Lighting**: AmbientLight (soft fill), DirectionalLight (key light), PointLight (dynamic, follows user)
- **Renderer**: WebXR-compatible with XR session management
- **UserCamera**: Virtual camera at eye level (0, 1.6, 0)
## 3.2 WebXR Session Management

WebXR session lifecycle:
1. Check XR support: `navigator.xr?.isSessionSupported('immersive-ar')`
2. Request session with requiredFeatures: ['local'], optionalFeatures: ['local-floor', 'bounded-floor'], domOverlay for UI
3. Set up XR session: Enable renderer.xr, set session, handle 'end' event
4. Frame loop with XR: Use renderer.setAnimationLoop() to update pose from XR frame and render AR content
5. Input handling: Use WebXR input profiles for motion controllers or touch/click for mobile AR

## 4. Real-Time Gamification Loop

### 4.1 Rep-to-Reward Feedback Loop

When a rep is detected:
1. Validate if rep is valid
2. Calculate form score (0-100%)
3. Determine XP gain based on form quality
4. Trigger visual/audio feedback (particle burst, floating numbers)

Quality multipliers:
- Perfect form (95-100%): 1.5x XP with crit particle effects
- Good form (80-94%): 1.0x XP with standard effects
- Fair form (60-79%): 0.5x XP with subtle effects
- Poor form (<60%): 0.1x XP with warning indicator

### 4.2 Boss Battle Progression

Boss health is scaled based on total reps required (increases with character level). The battle flows: Wait → Player doing reps → Boss HP depletes based on form-based damage → Boss reaction/visual effects → Boss defeated → Level up → New boss appears.

## 5. File Structure

```
ArGym/
├── src/
│   ├── components/
│   │   ├── ARScene.tsx           # Main Three.js/WebXR scene wrapper
│   │   ├── PoseVideo.tsx         # Video feed with pose overlay
│   │   ├── HUDOverlay.tsx        # UI overlay (reps, XP, stats)
│   │   ├── Avatar.tsx            # 3D avatar component
│   │   ├── ParticleSystem.tsx    # Particle effects
│   │   ├── BossBattle.tsx        # Boss health bar & battle UI
│   │   └── ProgressBar.tsx       # XP/progress bar component
│   │
│   ├── utils/
│   │   ├── poseDetection.ts      # MediaPipe pose integration
│   │   ├── repDetection.ts       # Rep counting state machine
│   │   ├── angleCalculation.ts   # Joint angle utilities
│   │   ├── formValidation.ts     # Form quality scoring
│   │   ├── webxrSetup.ts         # WebXR initialization
│   │   ├── threeScene.ts         # Three.js scene setup
│   │   └── audioManager.ts       # Audio feedback system
│   │
│   ├── state/
│   │   ├── playerStore.ts        # Zustand player state
│   │   ├── exerciseStore.ts      # Exercise/session state
│   │   └── persistence.ts        # LocalStorage/IndexedDB
│   │
│   ├── shaders/
│   │   ├── particleVert.glsl     # Particle vertex shader
│   │   ├── particleFrag.glsl     # Particle fragment shader
│   │   ├── xpBarVert.glsl        # XP bar vertex shader
│   │   └── xpBarFrag.glsl        # XP bar fragment shader
│   │
│   ├── events/
│   │   └── eventBus.ts           # Event system for decoupled comms
│   │
│   ├── types/
│   │   ├── pose.ts               # Pose/landmark types
│   │   ├── player.ts             # Player state types
│   │   ├── exercise.ts           # Exercise types
│   │   └── progression.ts        # Progression types
│   │
│   ├── App.tsx                   # Root React component
│   ├── main.tsx                  # Entry point
│   ├── index.css                 # Global styles
│   └── vite-env.d.ts             # Vite TypeScript declarations
│
├── public/
│   └── assets/
│       └── models/               # 3D model files (glb/gltf)
│
├── index.html                    # HTML entry
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript config
└── package.json                  # Dependencies
```

## 6. Technology Stack Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React + TypeScript + Vite | UI and app structure |
| 3D Rendering | Three.js | WebGL scene management |
| AR Support | WebXR Device API | Immersive AR sessions |
| Pose Estimation | @mediapipe/pose | Body landmark detection |
| State Management | Zustand | Reactive player/exercise state |
| Persistence | localStorage + IndexedDB | Save progression data |
| Shaders | GLSL (Three.js ShaderMaterial) | Custom particle/XP effects |
| Audio | Web Audio API | Rep feedback sounds |

## 7. Performance Considerations

- **Pose Detection Frequency**: Run at 15-30 FPS (balance accuracy/performance)
- **Three.js Render**: Match display refresh rate via requestAnimationFrame
- **Resource Loading**: Lazy-load 3D models and assets
- **Memory Management**: Clean up particle systems, dispose geometries
- **Battery Optimization**: Option to reduce pose model complexity

## 8. Browser Compatibility

| Browser | WebXR | MediaPipe | Notes |
|---------|-------|-----------|-------|
| Chrome Android | ✅ | ✅ | Primary target |
| Chrome Desktop | ✅ (with flags) | ✅ | Dev/testing |
| Safari iOS | ❌ | ⚠️ | Limited AR support |
| Firefox | ❌ | ✅ | No WebXR AR mode |
- **AR Content Layer**: Avatar/Character (3D model), HUD overlay (reps counter, XP bar, stats), Particle System (burst particles, ambient effects)
- **Boss Battle Elements**: Boss model, health bar, attack effects
- **Post-processing**: Bloom for glow effects, color correction, vignette