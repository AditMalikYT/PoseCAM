# ArGym - AR Calisthenics Gamification App

Turn your bodyweight workouts into an RPG adventure! ArGym uses your device camera and pose detection to track exercises like push-ups and pull-ups, translating them into XP, character progression, boss battles, and cosmetic rewards.

## Features

### 🎯 Pose Detection & Rep Counting
- Real-time MediaPipe Pose integration for body landmark tracking
- Smart rep detection state machine for push-ups and pull-ups
- Form validation with real-time feedback
- Joint angle calculation for accurate rep counting

### ⚔️ Boss Battles
- Defeat bosses by completing reps
- Boss health scales with player level
- Form-based damage calculation (perfect form = more damage!)
- Combo system for consecutive good reps

### 📈 Progression System
- Level up by earning XP through workouts
- Stat increases (Strength, Endurance, Flexibility)
- Achievement tracking
- Daily streak tracking with rewards

### 🎨 Cosmetic Rewards
- Unlockable avatars, auras, and accessories
- Rarity tiers (Common to Legendary)
- Visual progression feedback

### 🌐 AR Experience
- Three.js/WebXR for immersive 3D elements
- Particle effects on rep completion
- Floating XP/damage indicators
- Custom GLSL shaders for visual flair

## Technology Stack

- **Frontend**: React + TypeScript + Vite
- **3D/AR**: Three.js + WebXR Device API
- **Pose Detection**: MediaPipe Pose
- **State Management**: Zustand with localStorage persistence
- **Styling**: Custom CSS with CSS variables

## Project Structure

```
ArGym/
├── src/
│   ├── components/        # React components
│   ├── state/            # Zustand stores
│   ├── utils/            # Utility functions
│   │   ├── angleCalculation.ts  # Joint angle math
│   │   ├── repDetection.ts      # Rep state machine
│   │   ├── formValidation.ts    # Form quality scoring
│   │   ├── poseDetection.ts     # MediaPipe integration
│   │   └── threeScene.ts        # Three.js setup
│   ├── types/            # TypeScript definitions
│   ├── events/           # Event system
│   ├── shaders/          # GLSL shaders
│   ├── App.tsx           # Main app component
│   └── index.css         # Global styles
├── public/
│   └── favicon.svg
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Getting Started

### Prerequisites
- Node.js 18+
- Modern browser with WebRTC and WebXR support (Chrome recommended)
- Camera access

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Usage

1. **Grant Camera Permission**: Allow camera access when prompted
2. **Position Yourself**: Stand in frame with arms visible
3. **Start Workout**: Click "Start Workout" button
4. **Do Push-Ups**: Maintain proper form (straight body, full range of motion)
5. **Earn Rewards**: XP, levels, and boss defeats

## Form Guidelines

### Push-Up Form
- **Starting Position**: Arms extended, body in straight line
- **Descent**: Lower until chest nearly touches floor
- **Bottom**: Hold briefly, don't bounce
- **Ascent**: Push back up to starting position
- **Form Issues**: Sagging hips, partial range, too fast

### Scoring
- **Perfect (95%+)**: 1.5x XP, critical hits in boss battles
- **Good (80-94%)**: 1.0x XP, normal damage
- **Fair (60-79%)**: 0.5x XP, reduced damage
- **Poor (<60%)**: 0.2x XP, warning feedback

## Architecture Highlights

### Rep Detection State Machine

```
IDLE → (elbow bends) → DESCENT → (reach bottom) → BOTTOM → (extend) → ASCENT → (arms extended) → IDLE + REP COUNTED
```

### Angle Calculation

Uses dot product of vectors formed by landmark triplets:
- **Elbow angle**: Shoulder → Elbow → Wrist
- **Hip angle**: Shoulder → Hip → Knee
- **Knee angle**: Hip → Knee → Ankle

### XP Calculation

```typescript
xp = baseXp * levelMultiplier * formMultiplier * (perfectBonus | 1)
```

Where:
- `baseXp = 10`
- `levelMultiplier = 1.1^(level-1)`
- `formMultiplier = 0.5 + (formScore/100) * 0.5`
- `perfectBonus = 1.5` if formScore >= 95

## Accuracy Improvements

The pose detection has been upgraded to use MediaPipe's Pose Landmarker task with improved accuracy settings:

### Key Changes

1. **GPU Delegation** - Uses GPU acceleration for better performance
2. **VIDEO Mode** - Temporal consistency for smoother tracking
3. **Higher Confidence Thresholds** - 0.6 instead of 0.5 to reduce false positives
4. **Landmark Smoothing** - Exponential moving average to reduce jitter
5. **Multi-Frame Validation** - Requires 3 consistent frames before accepting detection
6. **Critical Landmark Weights** - Shoulders and hips weighted higher for better form detection

### Configuration

The model can be downloaded from:
```
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker/float16/1/pose_landmarker.task
```

Place it in `public/assets/models/pose_landmarker.task` for local hosting.

### Usage

```typescript
import { initPoseLandmarker, detectPose } from './utils/poseDetection';

// Initialize
await initPoseLandmarker(); // or pass custom model path

// In animation loop
const pose = await detectPose(videoElement, timestamp);
if (pose) {
  // Process landmarks
}
```

### Accuracy vs Performance

| Setting | Accuracy | FPS Impact |
|---------|----------|------------|
| Lite model + GPU | Good | High (~30fps) |
| Full model + GPU | Better | Medium (~20fps) |
| Lite model + CPU | Fair | Low (~15fps) |
| No smoothing | Worse | Same |
| No validation | Worse (more false positives) | Same |

### Adding New Exercises

1. Add exercise type to `src/types/exercise.ts`
2. Add detection logic to `src/utils/repDetection.ts`
3. Update `src/state/playerStore.ts` for session tracking
4. Add UI in `src/App.tsx`

### Customizing Progression

Edit `src/types/progression.ts`:
- `baseXpPerRep`: Base XP for each rep
- `xpMultiplierPerLevel`: How much harder levels get
- `statPointsPerLevel`: Stat increases per level

### Shader Customization

Edit GLSL files in `src/shaders/`:
- `particleVert.glsl` / `particleFrag.glsl`: Particle effects
- `xpBarVert.glsl` / `xpBarFrag.glsl`: XP bar rendering

## License

Apache License 2.0 - See LICENSE file for details.

## Acknowledgments

- [MediaPipe](https://mediapipe.dev/) for pose detection
- [Three.js](https://threejs.org/) for 3D rendering
- [Zustand](https://zustand-demo.pmnd.rs/) for state management
