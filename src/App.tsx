import { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from './state/playerStore';
import { useProgression } from './hooks/useProgression';
import StreakIndicator from './components/StreakIndicator';

const LevelUpModal = lazy(() => import('./components/LevelUpModal'));
const CosmeticsLocker = lazy(() => import('./components/CosmeticsLocker'));
const UnlockCelebrationModal = lazy(() => import('./components/UnlockCelebrationModal'));
const PoseGuideModal = lazy(() => import('./components/PoseGuideModal'));
import { eventBus, Events } from './events/eventBus';
import { initPoseLandmarker, detectPose, isReady } from './utils/poseDetection';
import {
  getAverageElbowAngle,
  getElbowAngle,
  getHipShoulderAngle,
  displayAngle,
  safeRoundAngle,
  getValidLandmarks,
  getAverageVisibility,
} from './utils/angleCalculation';
import {
  drawPoseCorrector,
  calibratePoseForPushups,
  POSE_CORRECTOR_COLORS,
  createPoseCorrectorState,
  IDEAL_PUSHUP_POSE,
  checkLandmarkAlignment,
  calculateAlignmentScore,
  getAlignmentStatus,
} from './utils/poseCorrector';
import {
  detectExerciseRep,
  DEFAULT_STATE_MACHINE,
  handleTrackingLoss,
  TRACKING_LOSS_RESET_MS,
} from './utils/repDetection';
import type { ExerciseRepStateMachine } from './utils/repDetection';
import { setupThreeScene, ThreeSceneSetup } from './utils/threeScene';
import { AuraRenderer } from './utils/auraRenderer';
import { FormAnalyzer } from './utils/FormAnalyzer';
import type { FormStatus, GuidanceExercise } from './types/formAnalyzer';
import { FAULT_SEVERITY } from './types/formAnalyzer';
import { unlockAudioCoach, playCoachSound } from './utils/audioCoach';
import FormFeedbackOverlay from './components/FormFeedbackOverlay';
import {
  IconCoins,
  IconBolt,
  IconGem,
  IconCamera,
  IconTarget,
  IconBug,
  IconBookOpen,
  IconSword,
  IconPlay,
  IconPause,
  IconShield,
  IconBag,
} from './components/icons';
import type { PoseLandmark, PoseLandmarkIndex } from './types/pose';
import type { ExerciseType } from './types/exercise';
import type { PoseCorrectorConfig, PoseAlignment } from './types/poseCorrector';
import { enableFullscreen } from './utils/fullscreen';
import * as THREE from 'three';

// MediaPipe skeleton joint connections
const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Upper body
  [11, 23], [12, 24], [23, 24],                    // Torso
  [23, 25], [25, 27], [24, 26], [26, 28],          // Legs
];

// Weekly streak multiplier formatting (1 -> "1", 1.15 -> "1.15", 2 -> "2")
const fmtMult = (mult: number) => mult.toFixed(2).replace(/\.?0+$/, '');

// Convert #rrggbb / #rgb hex into an rgba() string (for aura-driven glows).
const hexToRgba = (hex: string, alpha: number): string => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(int)) return hex;
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
};

// Default pose corrector configuration
const POSE_CORRECTOR_CONFIG: PoseCorrectorConfig = {
  enabled: false,
  showTargetSkeleton: true,
  showDeviationArrows: true,
  highlightMisaligned: true,
  misalignmentThreshold: 15,
};

interface DebugTelemetry {
  fps: number;
  frameTimeMs: number;
  leftElbow: number | null;
  rightElbow: number | null;
  avgElbow: number | null;
  leftHip: number | null;
  rightHip: number | null;
  avgHip: number | null;
  validKeypoints: number;
  totalKeypoints: number;
  avgConfidence: number;
  phase: string;
  minElbow: number;
  maxElbow: number;
  saggingFrames: number;
}

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isExerciseActive, setIsExerciseActive] = useState(false);
  const [exerciseType, setExerciseType] = useState<ExerciseType>('pushups');
  const [currentPhase, setCurrentPhase] = useState<string>('idle');
  const [lastFormFeedback, setLastFormFeedback] = useState<string | null>(null);

  // Debug Mode state & telemetry
  const [isDebugMode, setIsDebugMode] = useState(false);

  // Camera facing mode and recalibration
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [isRecalibrating, setIsRecalibrating] = useState(false);

  // Center rep-burst toast (floating HUD pop)
  const [repToast, setRepToast] = useState<string | null>(null);
  const repToastTimer = useRef<number | null>(null);

  // Accessory knob sprite load state (falls back to the glow dot on 404)
  const [accessoryImgFailed, setAccessoryImgFailed] = useState(false);

  useEffect(() => {
    return () => {
      if (repToastTimer.current !== null) window.clearTimeout(repToastTimer.current);
    };
  }, []);

  // Request fullscreen on the first user tap/touch (browsers require a gesture
  // before granting fullscreen access). Fires once per page load, then detaches.
  useEffect(() => {
    const trigger = () => {
      enableFullscreen();
      document.removeEventListener('pointerdown', trigger);
      document.removeEventListener('touchstart', trigger);
      document.removeEventListener('keydown', trigger);
    };
    document.addEventListener('pointerdown', trigger);
    document.addEventListener('touchstart', trigger);
    document.addEventListener('keydown', trigger);
    return () => {
      document.removeEventListener('pointerdown', trigger);
      document.removeEventListener('touchstart', trigger);
      document.removeEventListener('keydown', trigger);
    };
  }, []);

  // Workout set state (distinct from exercise active)
  const [isWorkingOut, setIsWorkingOut] = useState(false);
  const [isSetPaused, setIsSetPaused] = useState(false);

  // WebXR support detection state
  const [xrSupported, setXrSupported] = useState(false);
  const [telemetry, setTelemetry] = useState<DebugTelemetry>({
    fps: 0,
    frameTimeMs: 0,
    leftElbow: null,
    rightElbow: null,
    avgElbow: null,
    leftHip: null,
    rightHip: null,
    avgHip: null,
    validKeypoints: 0,
    totalKeypoints: 0,
    avgConfidence: 0,
    phase: 'idle',
    minElbow: 180,
    maxElbow: 0,
    saggingFrames: 0,
  });

  // Pose Corrector state
  const [isPoseCorrectorEnabled, setIsPoseCorrectorEnabled] = useState(false);
  const poseCorrectorStateRef = useRef(createPoseCorrectorState());
  const poseCorrectorAlignmentRef = useRef<PoseAlignment[]>([]);

  // === AR Form & Pose Guidance System state ===
  const [isFormGuidanceEnabled, setIsFormGuidanceEnabled] = useState(true);
  const formAnalyzerRef = useRef<FormAnalyzer | null>(null);
  const formStatusRef = useRef<FormStatus | null>(null);
  const [formUi, setFormUi] = useState<FormStatus | null>(null);
  const formUiSignatureRef = useRef<string>('');
  const prevFormPhaseRef = useRef<string>('SETUP');
  const prevFaultCodesRef = useRef<string>('');
  const prevSetupReadyRef = useRef<boolean | null>(null);
  const prevDepthReachedRef = useRef(false);
  const [showPoseGuide, setShowPoseGuide] = useState(false);
  const guideSeenRef = useRef<Set<string>>(new Set());

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeSetupRef = useRef<ThreeSceneSetup | null>(null);
  const auraRendererRef = useRef<AuraRenderer | null>(null);
  const stateMachineRef = useRef<ExerciseRepStateMachine>({ ...DEFAULT_STATE_MACHINE });
  const isDebugModeRef = useRef(isDebugMode);
  // Timestamp of the last frame that produced usable landmarks (FSM dropout expiry)
  const lastLandmarkSeenAtRef = useRef<number | null>(null);

  // FPS calculation references
  const fpsFrameCount = useRef(0);
  const fpsLastTime = useRef(performance.now());
  const currentFps = useRef(0);
  const lastFrameStart = useRef(performance.now());

  const {
    player, boss, session, addRep, startBossBattle, damageBoss,
    startSession, endSession,
  } = usePlayerStore();

  // Progression system: streak multiplier + level-up celebration triggers
  const prog = useProgression();

  // Cosmetic locker + equipped cosmetics (HUD accent + 3D aura config)
  const [lockerOpen, setLockerOpen] = useState(false);
  const equippedItems = usePlayerStore((s) => s.equipped);
  const cosmeticsList = usePlayerStore((s) => s.cosmetics);

  // Push the equipped aura/accessory visuals into the Three.js scene
  useEffect(() => {
    const find = (id: string | null) => cosmeticsList.find((c) => c.id === id) ?? null;
    const auraItem = find(equippedItems.aura);
    const accessoryItem = find(equippedItems.accessory);
    const hasFx = !!(auraItem?.aura || accessoryItem?.accessory);
    auraRendererRef.current?.setConfig(
      hasFx ? { aura: auraItem?.aura ?? null, accessory: accessoryItem?.accessory ?? null } : null
    );
  }, [equippedItems, cosmeticsList]);

  // Equipped cosmetics resolved for the HUD avatar accent + XP bar gradient
  const eqAvatar = useMemo(
    () => cosmeticsList.find((c) => c.id === equippedItems.avatar) ?? null,
    [cosmeticsList, equippedItems.avatar]
  );
  const eqAura = useMemo(
    () => cosmeticsList.find((c) => c.id === equippedItems.aura) ?? null,
    [cosmeticsList, equippedItems.aura]
  );
  const eqAccessory = useMemo(
    () => cosmeticsList.find((c) => c.id === equippedItems.accessory) ?? null,
    [cosmeticsList, equippedItems.accessory]
  );

  // Retry the knob sprite whenever the equipped accessory changes
  useEffect(() => setAccessoryImgFailed(false), [equippedItems.accessory]);

  // Sonar cues: level-up chime + streak-bonus blip
  useEffect(() => {
    if (prog.levelUp) playCoachSound('levelUp', true);
  }, [prog.levelUp]);

  useEffect(() => {
    if (prog.lastReward && prog.lastReward.bonusXp > 0) {
      playCoachSound('streakBonus');
    }
  }, [prog.lastReward]);

  useEffect(() => {
    isDebugModeRef.current = isDebugMode;
  }, [isDebugMode]);

  // (Re)create the FormAnalyzer when the exercise changes
  useEffect(() => {
    const guidanceExercise: GuidanceExercise = exerciseType === 'pullups' ? 'pullups' : 'pushups';
    formAnalyzerRef.current = new FormAnalyzer(guidanceExercise);
    formStatusRef.current = null;
    formUiSignatureRef.current = '';
    setFormUi(null);
  }, [exerciseType]);

  // Initialize Three.js scene overlay
  useEffect(() => {
    let setup: ThreeSceneSetup | null = null;
    let prevTime = performance.now();
    let animationFrameId: number;
    let disposed = false;

    const renderLoop = (time: number) => {
      if (!setup || disposed) return;
      const delta = Math.min((time - prevTime) / 1000, 0.1);
      prevTime = time;

      setup.updateFX(delta);
      setup.renderer.render(setup.scene, setup.camera);

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    // Async setup for WebXR feature detection
    setupThreeScene().then((sceneSetup) => {
      if (disposed) {
        // Already unmounted — clean up immediately
        sceneSetup.renderer.dispose();
        sceneSetup.renderer.domElement.remove();
        if (sceneSetup.xrButton) sceneSetup.xrButton.remove();
        return;
      }
      setup = sceneSetup;
      threeSetupRef.current = sceneSetup;
      auraRendererRef.current = new AuraRenderer(sceneSetup.scene, sceneSetup.camera);
      // Seed with the currently equipped aura/accessory config (live updates
      // arrive via the equipped-cosmetics effect below)
      const initial = usePlayerStore.getState();
      const eqAura = initial.cosmetics.find((c) => c.id === initial.equipped.aura);
      const eqAcc = initial.cosmetics.find((c) => c.id === initial.equipped.accessory);
      if (eqAura?.aura || eqAcc?.accessory) {
        auraRendererRef.current.setConfig({
          aura: eqAura?.aura ?? null,
          accessory: eqAcc?.accessory ?? null,
        });
      }
      // Sync XR support flag to React state (no UI banner — silent detection)
      setXrSupported(sceneSetup.xrSupported);
      animationFrameId = requestAnimationFrame(renderLoop);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      auraRendererRef.current?.dispose();
      auraRendererRef.current = null;
      if (setup) {
        setup.renderer.dispose();
        setup.renderer.domElement.remove();
        if (setup.xrButton) setup.xrButton.remove();
      }
    };
  }, []);

  // Initialize camera feed & MediaPipe pose detection
  useEffect(() => {
    let videoStream: MediaStream | null = null;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        videoStream = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          if (videoRef.current.readyState < 2) {
            await new Promise<void>((resolve) => {
              videoRef.current!.addEventListener('loadedmetadata', () => resolve(), { once: true });
            });
          }
          await videoRef.current.play();
        }

        // Initialize the new Pose Landmarker
        const success = await initPoseLandmarker();
        setIsInitialized(success);
      } catch (err) {
        console.error('Camera / Pose initialization error:', err);
      }
    };

    init();

    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Pose detection loop - using optimized throttled frame processing
  useEffect(() => {
    if (!isInitialized || !isReady()) return;

    let animationFrameId: number;
    let lastTimestamp = 0;
    let lastPoseDetectTime = 0;
    let isDetecting = false;
    let lastVideoTime = -1;
    let lastTelemetryUpdate = 0;

    const processFrame = async () => {
      animationFrameId = requestAnimationFrame(processFrame);

      if (!videoRef.current || !canvasRef.current || isDetecting) {
        return;
      }

      const video = videoRef.current;
      if (video.paused || video.ended || video.readyState < 2) return;

      const now = performance.now();
      const frameTimeMs = now - lastTimestamp;
      lastTimestamp = now;

      // FPS calculation
      fpsFrameCount.current++;
      if (now - fpsLastTime.current >= 500) {
        currentFps.current = Math.round((fpsFrameCount.current * 1000) / (now - fpsLastTime.current));
        fpsFrameCount.current = 0;
        fpsLastTime.current = now;
      }

      // Throttle pose detection to target ~30 FPS max (33ms) and only process when video frame has advanced
      if (now - lastPoseDetectTime < 30 || video.currentTime === lastVideoTime) {
        return;
      }

      lastVideoTime = video.currentTime;
      lastPoseDetectTime = now;
      isDetecting = true;

      let pose = null;
      try {
        pose = await detectPose(video, now);
      } finally {
        isDetecting = false;
      }

      if (!pose || !pose.landmarks || pose.landmarks.length === 0) {
        // Tracking lost / person out of frame. Keep the render loop alive,
        // refresh telemetry (instead of freezing at stale "0 Keypoints"),
        // clear the canvas with a diagnostic banner, and let the exercise
        // state machine expire gracefully via the tracking-loss fallback.
        const { state: resetState, reset } = handleTrackingLoss(
          stateMachineRef.current,
          now,
          lastLandmarkSeenAtRef.current,
          TRACKING_LOSS_RESET_MS
        );
        stateMachineRef.current = resetState;
        if (reset) setCurrentPhase((prev) => (prev !== resetState.phase ? resetState.phase : prev));

        drawSkeletonOverlay([], isDebugModeRef.current, null, null, null);

        if (isDebugModeRef.current && now - lastTelemetryUpdate > 250) {
          lastTelemetryUpdate = now;
          setTelemetry((prev) => ({
            ...prev,
            fps: currentFps.current,
            frameTimeMs: Math.round(frameTimeMs),
            leftElbow: null,
            rightElbow: null,
            avgElbow: null,
            leftHip: null,
            rightHip: null,
            avgHip: null,
            validKeypoints: 0,
            totalKeypoints: 0,
            avgConfidence: 0,
            phase: resetState.phase,
          }));
        }
        return;
      }

      // Usable landmarks: refresh the "last seen" clock for dropout expiry
      lastLandmarkSeenAtRef.current = now;

      // Use landmarks directly (smoothing is built into the detector now)
      const smoothedLandmarks = pose.landmarks;

      // Live cosmetic FX on the skeleton (aura rings, chest glow, wrist trails)
      auraRendererRef.current?.update(
        smoothedLandmarks,
        stateMachineRef.current.phase,
        now,
        frameTimeMs / 1000
      );

      /* === AR Form & Pose Guidance: analyze form every frame === */
      if (isFormGuidanceEnabled && formAnalyzerRef.current) {
        const formStatus = formAnalyzerRef.current.update(smoothedLandmarks, now);
        formStatusRef.current = formStatus;

        // Audio coach + event edges (fire only on transitions, not every frame)
        if (formStatus.currentPhase !== prevFormPhaseRef.current) {
          prevFormPhaseRef.current = formStatus.currentPhase;
          playCoachSound('phaseChange');
        }
        const faultKey = formStatus.faultCodes.join(',');
        if (formStatus.faultCodes.length > 0 && faultKey !== prevFaultCodesRef.current) {
          const hasCritical = formStatus.faultCodes.some((c) => FAULT_SEVERITY[c] === 'critical');
          eventBus.emit(Events.FORM_ISSUE_DETECTED, {
            faults: formStatus.faults,
            formScore: formStatus.metrics.formScore,
            severity: hasCritical ? 'critical' : 'warning',
          });
          playCoachSound(hasCritical ? 'fault' : 'warning');
        }
        prevFaultCodesRef.current = faultKey;

        if (prevSetupReadyRef.current === false && formStatus.setup.isReady) {
          playCoachSound('setupReady');
        }
        prevSetupReadyRef.current = formStatus.setup.isReady;

        if (formStatus.depthReached && !prevDepthReachedRef.current) {
          playCoachSound('topPosition');
        }
        prevDepthReachedRef.current = formStatus.depthReached;

        if (formStatus.repCycleComplete) {
          playCoachSound('repComplete');
        }

        // Throttled UI update: only re-render when something visible changed
        const signature = [
          formStatus.currentPhase,
          faultKey,
          formStatus.cue,
          formStatus.metrics.formScore,
          formStatus.setup.isReady ? 'ready' : formStatus.setup.warnings.join('|'),
          formStatus.isValidForm ? 'ok' : 'bad',
        ].join('~');
        if (signature !== formUiSignatureRef.current) {
          formUiSignatureRef.current = signature;
          setFormUi(formStatus);
        }
      }

      // Real-time joint angle computations for telemetry.
      // Each call is null-safe + visibility-gated (see calculate3PointAngle):
      // values are finite numbers or null - never NaN.
      const lElbow = getAverageElbowAngle(smoothedLandmarks);
      const leftElbowAngle = getElbowAngle(smoothedLandmarks, 'left');
      const rightElbowAngle = getElbowAngle(smoothedLandmarks, 'right');
      const lHip = getHipShoulderAngle(smoothedLandmarks, 'left');
      const rHip = getHipShoulderAngle(smoothedLandmarks, 'right');
      const avgH = lHip !== null && rHip !== null ? (lHip + rHip) / 2 : lHip ?? rHip;

      // Confidence & keypoint guard (always finite, 0 on empty)
      const validKeypoints = getValidLandmarks(smoothedLandmarks).length;
      const confidencePct = getAverageVisibility(smoothedLandmarks);

      // Draw 2D Skeleton Overlay (form-guidance color coding when active)
      drawSkeletonOverlay(
        smoothedLandmarks,
        isDebugModeRef.current,
        leftElbowAngle,
        rightElbowAngle,
        avgH,
        isFormGuidanceEnabled && !isDebugModeRef.current
          ? formStatusRef.current?.jointColors
          : undefined
      );

      // Draw Pose Corrector overlay if enabled
      if (isPoseCorrectorEnabled && poseCorrectorStateRef.current.isCalibrated) {
        const width = canvasRef.current?.width || 640;
        const height = canvasRef.current?.height || 480;

        // Update alignment for each frame
        poseCorrectorAlignmentRef.current = [];
        for (let idx = 11; idx <= 28; idx++) {
          const target = IDEAL_PUSHUP_POSE[idx];
          if (target) {
            const alignment = checkLandmarkAlignment(
              smoothedLandmarks[idx],
              target,
              POSE_CORRECTOR_CONFIG.misalignmentThreshold,
              width,
              height,
              idx as PoseLandmarkIndex,
            );
            if (alignment.actualPosition) {
              poseCorrectorAlignmentRef.current.push(alignment);
            }
          }
        }

        // Update state
        poseCorrectorStateRef.current.currentAlignment = poseCorrectorAlignmentRef.current;
        poseCorrectorStateRef.current.overallScore = calculateAlignmentScore(poseCorrectorAlignmentRef.current);

        // Draw the corrector
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
          drawPoseCorrector(
            ctx,
            canvasRef.current!,
            smoothedLandmarks,
            IDEAL_PUSHUP_POSE,
            POSE_CORRECTOR_CONFIG,
            poseCorrectorAlignmentRef.current
          );
        }
      }

      // Update Debug Telemetry state throttled to ~4Hz (250ms) to avoid high main-thread React re-render churn
      if (isDebugModeRef.current && now - lastTelemetryUpdate > 250) {
        lastTelemetryUpdate = now;
        setTelemetry({
          fps: currentFps.current,
          frameTimeMs: Math.round(frameTimeMs),
          leftElbow: safeRoundAngle(leftElbowAngle),
          rightElbow: safeRoundAngle(rightElbowAngle),
          avgElbow: safeRoundAngle(lElbow),
          leftHip: safeRoundAngle(lHip),
          rightHip: safeRoundAngle(rHip),
          avgHip: safeRoundAngle(avgH),
          validKeypoints,
          totalKeypoints: smoothedLandmarks.length,
          avgConfidence: Math.round(confidencePct),
          phase: stateMachineRef.current.phase,
          minElbow: safeRoundAngle(stateMachineRef.current.minElbowAchieved) ?? 180,
          maxElbow: safeRoundAngle(stateMachineRef.current.maxElbowAchieved) ?? 0,
          saggingFrames: safeRoundAngle(stateMachineRef.current.consecutiveSaggingFrames) ?? 0,
        });
      }

      // Exercise Rep State Machine Processing
      if (isExerciseActive) {
        const { state: nextState, result } = detectExerciseRep(
          exerciseType,
          smoothedLandmarks,
          stateMachineRef.current,
          now
        );

        stateMachineRef.current = nextState;
        setCurrentPhase((prev) => (prev !== nextState.phase ? nextState.phase : prev));

        // Form issue feedback
        if (result.formIssues && result.formIssues.length > 0) {
          setLastFormFeedback(result.formIssues[0].message);
        } else {
          setLastFormFeedback(null);
        }

        // On valid rep completed
        if (result.repCounted) {
          addRep(result.formScore);
          eventBus.emit(Events.REP_COMPLETED, {
            repNumber: session.repCount + 1,
            formScore: result.formScore,
            xpEarned: 15,
          });

          setRepToast(`+1 REP · ${result.formScore}%`);
          if (repToastTimer.current !== null) window.clearTimeout(repToastTimer.current);
          repToastTimer.current = window.setTimeout(() => setRepToast(null), 1100);

          // VFX Particle Burst & Floating XP
          threeSetupRef.current?.spawnParticleBurst(new THREE.Vector3(0, 1.5, -2), 0x00f3ff, 80);
          threeSetupRef.current?.spawnFloatingText('+15 XP!', new THREE.Vector3(0, 1.8, -2), 0x00ff88);

          // Boss Battle Damage logic
          if (boss.isActive) {
            const dmg = Math.round(20 * (1 + result.formScore / 100));
            damageBoss(dmg, result.formScore);
            eventBus.emit(Events.BOSS_DAMAGE_TAKEN, dmg, result.formScore);

            threeSetupRef.current?.spawnParticleBurst(new THREE.Vector3(0, 1.2, -2), 0xff007a, 100);
            threeSetupRef.current?.spawnFloatingText(`-${dmg} HP!`, new THREE.Vector3(0.5, 1.5, -2), 0xff2a6d);
          }
        }
      }

      animationFrameId = requestAnimationFrame(processFrame);
    };

    animationFrameId = requestAnimationFrame(processFrame);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isInitialized, isExerciseActive, exerciseType, addRep, boss.isActive, damageBoss, session.repCount]);

  // Draw 2D Pose Skeleton on Overlay Canvas
  // Enhanced debug renderer: draws ALL joints, color-codes keypoints by
  // confidence (solid = confidence > 0.5, red = unstable) so camera
  // positioning issues are diagnosable visually, and renders annotations
  // through displayAngle (finite degrees or "N/A").
  const drawSkeletonOverlay = (
    landmarks: PoseLandmark[],
    debug: boolean,
    leftElbowAngle: number | null,
    rightElbowAngle: number | null,
    hipAngle: number | null,
    formColors?: Record<string, string>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // No tracking: cleared canvas + diagnostic banner (telemetry shows "N/A")
    if (!landmarks || landmarks.length === 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, canvas.height / 2 - 34, canvas.width, 68);
      ctx.fillStyle = '#ff007a';
      ctx.font = '900 20px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ NO PERSON DETECTED — STEP INTO FRAME', canvas.width / 2, canvas.height / 2 + 7);
      ctx.textAlign = 'left';
      return;
    }

    // Form-guidance severity rank (green < yellow < red) for stick coloring
    const severityRank = (hex: string | undefined): number => {
      if (hex === '#ff2a6d') return 2;
      if (hex === '#ffd700') return 1;
      return 0;
    };
    const stickColorFromForm = (i: number, j: number): string | null => {
      if (!formColors) return null;
      const c1 = formColors[String(i)];
      const c2 = formColors[String(j)];
      if (c1 === undefined && c2 === undefined) return null;
      const rank1 = severityRank(c1);
      const rank2 = severityRank(c2);
      const worst = rank1 >= rank2 ? c1 : c2;
      if (!worst) return null;
      if (Math.max(rank1, rank2) === 2) return '#ff2a6d';
      if (Math.max(rank1, rank2) === 1) return '#ffd700';
      return '#00ff88';
    };

    // Skeleton sticks - premium neon rendering: wide halo pass + gradient core.
    // Form-colored when AR guidance is active, else confidence-coded cyan.
    for (const [i, j] of POSE_CONNECTIONS) {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      if (!p1 || !p2) continue;

      const stickConfidence = Math.min(p1.visibility ?? 0, p2.visibility ?? 0);
      if (stickConfidence <= 0.2) continue; // too unstable to draw usefully

      const formColor = stickColorFromForm(i, j);
      const baseColor = debug
        ? (stickConfidence > 0.5 ? '#ffd700' : 'rgba(255, 68, 68, 0.8)')
        : (formColor ?? (stickConfidence > 0.5 ? '#00f0ff' : 'rgba(255, 68, 68, 0.55)'));
      const tipColor = formColor ? formColor : debug ? '#ffffff' : '#38b6ff';

      const x1 = p1.x * canvas.width, y1 = p1.y * canvas.height;
      const x2 = p2.x * canvas.width, y2 = p2.y * canvas.height;

      // Outer glow halo
      ctx.save();
      ctx.globalAlpha = debug ? 0.14 : 0.2;
      ctx.lineCap = 'round';
      ctx.lineWidth = debug ? 13 : 12;
      ctx.strokeStyle = baseColor;
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();

      // Gradient core
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, baseColor);
      grad.addColorStop(1, tipColor);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = debug ? 4.5 : 3.5;
      ctx.strokeStyle = grad;
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();

      // Hot center shine
      if (!debug) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.lineCap = 'round';
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Joint nodes - neon halo + core, with pulse rings on key trigger joints.
    const nowMs = performance.now() / 1000;
    for (let idx = 0; idx < landmarks.length; idx++) {
      const p = landmarks[idx];
      if (!p) continue;

      const confidence = p.visibility ?? 0;
      if (confidence <= 0.2) continue; // nearly invisible - skip node

      const bodyJoint = idx >= 11; // face landmarks (0-10) drawn smaller
      const radius = debug ? (bodyJoint ? 7 : 4) : (bodyJoint ? 6 : 3);
      const formColor = bodyJoint ? formColors?.[String(idx)] : undefined;
      const color = formColor
        ? formColor
        : confidence > 0.5
          ? (debug ? '#ff007a' : '#00ff88')
          : 'rgba(255, 68, 68, 0.85)';

      const px = p.x * canvas.width;
      const py = p.y * canvas.height;

      // Trigger pulse: elbows near the bottom of a rep + hip kept in a rigid line
      let triggered = false;
      if (idx === 13 || idx === 14) {
        triggered = (leftElbowAngle ?? 180) < 95 || (rightElbowAngle ?? 180) < 95;
      }
      if (idx === 23 || idx === 24) {
        triggered = (hipAngle ?? 0) > 160;
      }

      // Expanding trigger ring (pulse when joints hit key trigger angles)
      if (triggered && bodyJoint) {
        const pulseR = radius * 2.2 + ((Math.sin(nowMs * 7) + 1) / 2) * radius * 1.6;
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.6;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.restore();
      }

      // Outer halo
      if (bodyJoint) {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        ctx.arc(px, py, radius * 2.7, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.restore();
      }

      // Core node
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = bodyJoint ? 14 : 5;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (debug && bodyJoint) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(`#${idx}`, px + 10, py + 4);
        ctx.shadowBlur = 0;
      }
    }

    // Debug Mode angle annotations on canvas (displayAngle -> "N/A" fallback)
    if (debug) {
      const leftElbow = landmarks[13];
      const rightElbow = landmarks[14];
      const leftHip = landmarks[23];

      ctx.font = '900 16px "Outfit", sans-serif';

      // Elbow annotations: L drawn at the left elbow node, R at the right;
      // whichever arm is visible (fallback renderer covers occlusion)
      if (leftElbow && (leftElbow.visibility ?? 0) > 0.4 && leftElbowAngle !== null) {
        ctx.fillStyle = '#00f3ff';
        ctx.fillText(displayAngle(leftElbowAngle), leftElbow.x * canvas.width - 25, leftElbow.y * canvas.height - 12);
      } else if (rightElbow && (rightElbow.visibility ?? 0) > 0.4 && rightElbowAngle !== null) {
        ctx.fillStyle = '#00f3ff';
        ctx.fillText(displayAngle(rightElbowAngle), rightElbow.x * canvas.width - 25, rightElbow.y * canvas.height - 12);
      }

      if (leftHip && (leftHip.visibility ?? 0) > 0.4) {
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`Hip: ${displayAngle(hipAngle)}`, leftHip.x * canvas.width + 12, leftHip.y * canvas.height + 4);
      }

      // Tracking-stability chip when too few keypoints exceed the threshold
      const validCount = getValidLandmarks(landmarks).length;
      if (validCount < 6) {
        ctx.fillStyle = 'rgba(255, 68, 68, 0.9)';
        ctx.font = '800 14px "Outfit", sans-serif';
        ctx.fillText(`⚠ Tracking unstable (${validCount} keypoints > 0.5 confidence)`, 12, 24);
      }
    }
  };

  // Workout controls
  const doStartWorkout = () => {
    stateMachineRef.current = { ...DEFAULT_STATE_MACHINE };
    formAnalyzerRef.current?.reset(true);
    formUiSignatureRef.current = '';
    prevFormPhaseRef.current = 'SETUP';
    prevFaultCodesRef.current = '';
    startSession(exerciseType);
    setIsExerciseActive(true);
    setCurrentPhase('idle');
    setShowPoseGuide(false);
  };

  const handleStartWorkout = () => {
    // Unlock the audio coach on this user gesture, then show the visual
    // Pose Guide once per exercise before the set starts.
    unlockAudioCoach();
    if (!guideSeenRef.current.has(exerciseType)) {
      guideSeenRef.current.add(exerciseType);
      setShowPoseGuide(true);
    } else {
      doStartWorkout();
    }
  };

  const handleEndWorkout = () => {
    endSession();
    setIsExerciseActive(false);
    setCurrentPhase('idle');
  };

  const handleStartBoss = () => {
    const bossHealth = 100 + (player.currentLevel - 1) * 50;
    startBossBattle(`boss_${player.currentLevel}`, `Level ${player.currentLevel} Guardian`, bossHealth);
  };

  // Camera controls
  const toggleCameraFacing = () => {
    const newMode = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(newMode);
    // Restart video with new facing mode
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    // Reinitialize camera with new facing mode
    initializeCamera(newMode);
    eventBus.emit(Events.CAMERA_SWITCHED, { facingMode: newMode });
  };

  const recalibrateCamera = () => {
    setIsRecalibrating(true);
    // Reset pose corrector calibration
    poseCorrectorStateRef.current = createPoseCorrectorState();
    // Reset telemetry tracking state
    setTelemetry(prev => ({ ...prev, saggingFrames: 0, minElbow: 180, maxElbow: 0 }));
    setTimeout(() => setIsRecalibrating(false), 1500);
    eventBus.emit(Events.CAMERA_RECALIBRATED, { timestamp: Date.now() });
  };

  // Set controller (Start/Pause toggle)
  const toggleSet = () => {
    if (!isWorkingOut) {
      // Start new set
      setIsWorkingOut(true);
      setIsSetPaused(false);
      handleStartWorkout();
    } else if (isSetPaused) {
      // Resume set
      setIsSetPaused(false);
      setIsExerciseActive(true);
    } else {
      // Pause set
      setIsSetPaused(true);
      setIsExerciseActive(false);
    }
  };

  // Initialize camera with specific facing mode
  const initializeCamera = async (facingMode: 'user' | 'environment') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('[Camera] Failed to initialize camera:', err);
    }
  };

  // Equipped aura drives the card frame accent: border, corner brackets,
  // avatar ring + glow shadow (defaults to the base cyber-cyan palette).
  const auraColor = eqAura?.aura?.color ?? '#00f0ff';
  const auraGlow = hexToRgba(auraColor, 0.42);
  const auraGlowSoft = hexToRgba(auraColor, 0.14);
  const cardStyle = {
    '--avatar-accent': eqAvatar?.avatarColor ?? '#00f0ff',
    '--aura-accent': auraColor,
    '--aura-glow': auraGlow,
    borderColor: auraColor,
    boxShadow: `var(--glass-shadow), var(--glass-inset), 0 0 34px ${auraGlow}, 0 0 90px ${auraGlowSoft}`,
  } as React.CSSProperties;

  // XP fill percentage — drives both the fill width and the bar knob position.
  const xpPct = Math.min(100, (player.currentXp / player.xpToNextLevel) * 100);
  const knobDotColor = eqAccessory?.accessory?.color ?? '#00f0ff';

  return (
    <div className="app">

      {/* Camera Feed & 2D Skeleton Canvas */}
      <div className="video-container">
        <video ref={videoRef} playsInline muted className="video-feed" />
        <canvas ref={canvasRef} width={640} height={480} className="pose-canvas" />
      </div>

      {/* 3D / AR Three.js Canvas Container */}
      <div id="ar-container" />

      {/* Hidden h1 for accessibility and SEO semantic hierarchy */}
      <h1 className="sr-only">ArGym - AR Calisthenics RPG Workout Assistant</h1>

      {/* Glassmorphic Cyber-HUD */}
      <div className="hud">
        <div className="hud-top">
          {/* Character Card (equipped avatar accent + 2D sprite via --avatar-accent) */}
          <div
            className="character-card"
            style={cardStyle}
          >
            {eqAvatar?.imageUrl && (
              <div className="character-card-avatar">
                <img src={eqAvatar.imageUrl} alt={eqAvatar.name} />
              </div>
            )}
            <div className="level-display">
              <span className="level-number">Lv.{player.currentLevel}</span>
            </div>
            <div className="xp-bar-container">
              <div className="xp-track-wrap">
                <div className="xp-bar-track">
                  <div
                    className="xp-bar-fill"
                    style={{
                      width: `${xpPct}%`,
                      background: eqAura?.aura
                        ? `linear-gradient(90deg, var(--energy-cyan), ${eqAura.aura.color})`
                        : undefined,
                    }}
                  />
                </div>
                {/* Slider knob: equipped accessory image when available, else a glowing dot */}
                <div className="xp-bar-knob" style={{ left: `${xpPct}%` }}>
                  {eqAccessory?.imageUrl && !accessoryImgFailed ? (
                    <img
                      className="xp-bar-knob-img"
                      src={eqAccessory.imageUrl}
                      alt={eqAccessory.name}
                      onError={() => setAccessoryImgFailed(true)}
                      style={{
                        filter: `drop-shadow(0 0 6px ${hexToRgba(knobDotColor, 0.9)})`,
                      }}
                    />
                  ) : (
                    <span
                      className="xp-bar-knob-dot"
                      style={{
                        background: knobDotColor,
                        boxShadow: `0 0 9px ${hexToRgba(knobDotColor, 0.9)}, 0 0 22px ${hexToRgba(knobDotColor, 0.45)}`,
                      }}
                    />
                  )}
                </div>
              </div>
              <div className="xp-bar-label">
                <span>XP</span>
                <span>{player.currentXp} / {player.xpToNextLevel}</span>
              </div>
            </div>
          </div>

          {/* Resource Bar - luxury pills */}
          <div className="resource-bar">
            <div className="resource-item res-coin">
              <span className="resource-icon">
                <IconCoins width={18} height={18} />
              </span>
              <span>{player.totalXpEarned.toLocaleString()}</span>
            </div>
            <div className="resource-item res-energy">
              <span className="resource-icon">
                <IconBolt width={18} height={18} />
              </span>
              <span>{player.stats.strength}</span>
            </div>
            <div className="resource-item res-gem">
              <span className="resource-icon">
                <IconGem width={18} height={18} />
              </span>
              <span>{player.stats.endurance}</span>
            </div>
          </div>

          {/* Streak XP multiplier (flame pill + tier tooltip) */}
          <StreakIndicator
            streak={prog.streak}
            pulseToken={prog.streakBonusPulse}
          />

          {/* Top-Right Quick Actions */}
          <div className="quick-actions">
            <button
              className="quick-action-btn"
              onClick={toggleCameraFacing}
              title={cameraFacingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'}
            >
              <span className="quick-action-icon">
                <IconCamera width={22} height={22} />
              </span>
              <span className="quick-action-label">{cameraFacingMode === 'user' ? 'Front' : 'Rear'}</span>
            </button>
            <button
              className={`quick-action-btn ${isRecalibrating ? 'recalibrating' : ''}`}
              onClick={recalibrateCamera}
              disabled={isRecalibrating}
              title="Recalibrate pose detection"
            >
              <span className="quick-action-icon">
                <IconTarget width={22} height={22} />
              </span>
              <span className="quick-action-label">{isRecalibrating ? 'Cal...' : 'Recal'}</span>
            </button>
          </div>
        </div>

        {/* Rep Counter - Cyber HUD Ring (depth / form / rep-burst arcs) */}
        {isExerciseActive && (() => {
          const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
          const depth = clamp01((165 - (stateMachineRef.current.minElbowAchieved ?? 180)) / 95);
          const form = clamp01((formUi?.metrics.formScore ?? session.currentFormScore) / 100);
          const reps = clamp01(session.repCount / 10);
          const ring = (radius: number, progress: number, strokeClass: string, key: string) => {
            const c = 2 * Math.PI * radius;
            return (
              <g key={key}>
                <circle className="hud-arc-track" cx="60" cy="60" r={radius} />
                <circle
                  className={`hud-ring-arc ${strokeClass}`}
                  cx="60" cy="60" r={radius}
                  strokeDasharray={`${c}`}
                  strokeDashoffset={`${c * (1 - progress)}`}
                  style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
              </g>
            );
          };
          return (
            <div className={`rep-counter ${repToast ? 'rep-pulse' : ''}`}>
              <div className="hud-ring">
                <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="ringGradCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00f0ff" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                    <linearGradient id="ringGradGold" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff8800" />
                      <stop offset="100%" stopColor="#ffb800" />
                    </linearGradient>
                    <linearGradient id="ringGradGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00ff85" />
                      <stop offset="100%" stopColor="#00f0ff" />
                    </linearGradient>
                  </defs>
                  {ring(52, reps, 'ring-grad-green', 'r-reps')}
                  {ring(43, form, 'ring-grad-gold', 'r-form')}
                  {ring(34, depth, 'ring-grad-cyan', 'r-depth')}
                </svg>
                <div className="rep-hud-center">
                  <span className="rep-arc-number">{session.repCount}</span>
                  <span className="rep-label">Reps</span>
                </div>
              </div>
              <div className="ring-caps">
                <span className="ring-cap cyan">Depth {Math.round(depth * 100)}%</span>
                <span className="ring-cap gold">Form {Math.round(form * 100)}%</span>
                <span className="ring-cap green">{reps >= 1 ? `${session.repCount}/10` : 'Ready'}</span>
              </div>
              <span className="rep-target">Target 10 reps</span>
            </div>
          );
        })()}

        {/* Floating rep-burst toast */}
        {isExerciseActive && repToast && (
          <div className="float-rep-toast">{repToast}</div>
        )}

        {/* Floating streak-bonus XP popups */}
        <div className="float-xp-layer">
          <AnimatePresence>
            {prog.floatingXp.map((item) => (
              <motion.div
                key={item.id}
                className={`float-xp-item ${item.bonusXp > 0 ? 'bonus' : ''}`}
                style={{ left: `calc(50% + ${(item.id % 4) * 26 - 39}px)` }}
                initial={{ opacity: 0, x: '-50%', y: 0, scale: 0.5 }}
                animate={{ opacity: [0, 1, 1, 0], x: '-50%', y: -150, scale: 1 }}
                exit={{ opacity: 0, y: -120, scale: 0.9 }}
                transition={{ duration: 1.4, times: [0, 0.15, 0.7, 1], ease: 'easeOut' }}
              >
                <span className="float-xp-main">+{item.totalXp} XP</span>
                {item.bonusXp > 0 && (
                  <span className="float-xp-bonus">
                    +{item.bonusXp} BP · ×{fmtMult(item.multiplier)} {item.tierLabel}
                  </span>
                )}
                {item.perfect && <span className="float-xp-perfect">PERFECT</span>}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Dynamic Exercise Phase Indicator */}
        {isExerciseActive && (
          <div className="phase-indicator">
            <div className="phase-dot" />
            <span>{currentPhase === 'idle' && 'GET READY'}
              {currentPhase === 'descent' && 'DOWN'}
              {currentPhase === 'bottom' && 'HOLD'}
              {currentPhase === 'ascent' && 'UP!'}
              {currentPhase === 'pulling' && 'PULL!'}
              {currentPhase === 'top' && 'TOP!'}
              {currentPhase === 'lowering' && 'LOWER'}</span>
          </div>
        )}

        {/* Real-Time Form Guidance Overlay (cue banner + fault chips + phase) */}
        {isExerciseActive && isFormGuidanceEnabled && (
          <FormFeedbackOverlay
            status={formUi}
            exercise={exerciseType === 'pullups' ? 'pullups' : 'pushups'}
          />
        )}

        {/* Form Warning Toast (rep-FSM issues; hidden when guidance overlay is active) */}
        {isExerciseActive && lastFormFeedback && !isFormGuidanceEnabled && (
          <div style={{
            position: 'absolute',
            bottom: '6.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 42, 109, 0.85)',
            backdropFilter: 'blur(12px)',
            color: '#fff',
            fontWeight: 800,
            padding: '0.6rem 1.5rem',
            borderRadius: '50px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 0 20px rgba(255, 42, 109, 0.5)',
            zIndex: 20,
          }}>
            {lastFormFeedback}
          </div>
        )}

        {/* DEBUG MODE OVERLAY PANEL */}
        {isDebugMode && (
          <div className="debug-panel">
            <div className="debug-header">
              <span className="debug-title">
                <IconBug width={14} height={14} /> DEBUG TELEMETRY
              </span>
              <span className={`debug-badge ${telemetry.fps >= 30 ? 'good' : 'warn'}`}>
                {telemetry.fps} FPS ({telemetry.frameTimeMs}ms)
              </span>
            </div>

            <div className="debug-grid">
              <div className="debug-item">
                <span className="debug-label">Elbow Angles:</span>
                <span className="debug-val">
                  L: {telemetry.leftElbow !== null ? `${telemetry.leftElbow}°` : 'N/A'} |
                  R: {telemetry.rightElbow !== null ? `${telemetry.rightElbow}°` : 'N/A'} |
                  Avg: {telemetry.avgElbow !== null ? `${telemetry.avgElbow}°` : 'N/A'}
                </span>
              </div>

              <div className="debug-item">
                <span className="debug-label">Hip Alignment:</span>
                <span className="debug-val">
                  L: {telemetry.leftHip !== null ? `${telemetry.leftHip}°` : 'N/A'} |
                  R: {telemetry.rightHip !== null ? `${telemetry.rightHip}°` : 'N/A'} |
                  Avg: {telemetry.avgHip !== null ? `${telemetry.avgHip}°` : 'N/A'}
                </span>
              </div>

              <div className="debug-item">
                <span className="debug-label">Tracking Quality:</span>
                <span className="debug-val">
                  {telemetry.validKeypoints} / {telemetry.totalKeypoints} Keypoints | Confidence: {telemetry.avgConfidence}%
                </span>
              </div>

              <div className="debug-item">
                <span className="debug-label">State Machine:</span>
                <span className="debug-val">
                  Phase: {telemetry.phase.toUpperCase()} | Min: {telemetry.minElbow}° | Max: {telemetry.maxElbow}° | Sagging: {telemetry.saggingFrames}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Boss Battle UI */}
        {boss.isActive && (
          <div className="boss-ui">
            <div className="boss-header">
              <span className="boss-name">
                <IconSword width={16} height={16} /> {boss.bossName}
              </span>
              <span className="boss-health-text">{boss.bossHealth} / {boss.maxHealth} HP</span>
            </div>
            <div className="boss-health-bar">
              <div
                className="boss-health-fill"
                style={{ width: `${Math.max(0, (boss.bossHealth / boss.maxHealth) * 100)}%` }}
              />
            </div>
            {boss.currentPhase === 'victory' && (
              <div className="boss-victory">
                <span className="victory-text">VICTORY!</span>
                <button
                  onClick={() => {
                    usePlayerStore.getState().defeatBoss();
                    eventBus.emit(Events.BOSS_DEFEATED);
                  }}
                  className="btn-primary"
                >
                  Next Boss
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Exercise Selector & Debug Mode Toggle */}
      <div className="exercise-selector">
        <button
          className={`exercise-btn ${exerciseType === 'pushups' ? 'active' : ''}`}
          onClick={() => setExerciseType('pushups')}
        >
          Push-Ups
        </button>
        <button
          className={`exercise-btn ${exerciseType === 'pullups' ? 'active' : ''}`}
          onClick={() => setExerciseType('pullups')}
        >
          Pull-Ups
        </button>
        <button
          className={`exercise-btn pose-corrector-btn ${isPoseCorrectorEnabled ? 'active' : ''}`}
          onClick={() => {
            setIsPoseCorrectorEnabled(!isPoseCorrectorEnabled);
            if (!isPoseCorrectorEnabled && poseCorrectorStateRef.current.isCalibrated === false) {
              // Auto-calibrate when enabling
              poseCorrectorStateRef.current = calibratePoseForPushups([]); // Will be updated on next frame
            }
          }}
        >
          <IconTarget className="btn-icon" width={16} height={16} /> Pose Guide
        </button>
        <button
          className={`exercise-btn form-guidance-btn ${isFormGuidanceEnabled ? 'active' : ''}`}
          onClick={() => setIsFormGuidanceEnabled(!isFormGuidanceEnabled)}
        >
          <IconShield className="btn-icon" width={16} height={16} /> Form Coach
        </button>
        <button
          className="exercise-btn pose-guide-btn"
          onClick={() => {
            unlockAudioCoach();
            setShowPoseGuide(true);
          }}
        >
          <IconBookOpen className="btn-icon" width={16} height={16} /> Form Tutorial
        </button>
      </div>

      {/* Bottom Action Bar - primary controls */}
      <div className="bottom-action-bar">
        {/* Exercise switcher group */}
        <div className="bottom-action-group">
          <button
            className={`exercise-btn ${exerciseType === 'pushups' ? 'active' : ''}`}
            onClick={() => setExerciseType('pushups')}
          >
            Push-Ups
          </button>
          <button
            className={`exercise-btn ${exerciseType === 'pullups' ? 'active pullups' : ''}`}
            onClick={() => setExerciseType('pullups')}
          >
            Pull-Ups
          </button>
        </div>

        {/* Set Controller - primary CTA */}
        <button
          className={`btn-set-cta ${isWorkingOut ? (isSetPaused ? 'paused' : 'active-set') : ''}`}
          onClick={toggleSet}
        >
          {!isWorkingOut && <><IconPlay width={18} height={18} /> Start Set</>}
          {isWorkingOut && isSetPaused && <><IconPlay width={18} height={18} /> Resume</>}
          {isWorkingOut && !isSetPaused && <><IconPause width={18} height={18} /> Pause</>}
        </button>

        {/* End Workout */}
        <button
          className="btn-end-workout"
          onClick={handleEndWorkout}
          disabled={!isWorkingOut}
        >
          END WORKOUT
        </button>
      </div>

      {/* Bottom-Left Control Dock */}
      <div className="bottom-left-dock">
        <button
          className={`dock-btn ${isDebugMode ? 'active' : ''}`}
          onClick={() => setIsDebugMode(!isDebugMode)}
          title="Debug Telemetry"
          aria-label="Debug Telemetry"
        >
          <IconBug width={20} height={20} />
        </button>
        <button
          className="dock-btn"
          onClick={() => {
            unlockAudioCoach();
            setShowPoseGuide(true);
          }}
          title="Pose Guide"
          aria-label="Pose Guide"
        >
          <IconBookOpen width={20} height={20} />
        </button>
        <button
          className={`dock-btn ${lockerOpen ? 'active' : ''}`}
          onClick={() => setLockerOpen(!lockerOpen)}
          title="Cosmetic Locker"
          aria-label="Cosmetic Locker"
        >
          <IconBag width={20} height={20} />
        </button>
      </div>

      {/* Pose Corrector Status Indicator */}
      {isPoseCorrectorEnabled && (
        <div className="pose-corrector-status">
          <div className={`pose-corrector-dot ${poseCorrectorStateRef.current.isCalibrated ? '' : 'off'}`} />
          <span className="pose-corrector-score">
            {poseCorrectorStateRef.current.overallScore}%
          </span>
          <span className="pose-corrector-label">
            {getAlignmentStatus(poseCorrectorStateRef.current.overallScore)}
          </span>
        </div>
      )}

      {/* Boss Battle Launch Button */}
      {!boss.isActive && (
        <button onClick={handleStartBoss} className="btn-boss">
          <IconSword width={18} height={18} /> Boss Battle
        </button>
      )}

      {/* Dynamic Lazy Loaded Modals & Overlays */}
      <Suspense fallback={null}>
        {/* Visual Exercise Guide Modal (step-by-step 3D illustrations) */}
        {showPoseGuide && (
          <PoseGuideModal
            exercise={exerciseType === 'pullups' ? 'pullups' : 'pushups'}
            open={showPoseGuide}
            onClose={() => setShowPoseGuide(false)}
            onStartSet={doStartWorkout}
          />
        )}

        {/* Level-Up Celebration Sequence */}
        {prog.levelUp && (
          <LevelUpModal data={prog.levelUp} onClose={prog.dismissLevelUp} />
        )}

        {/* Cosmetic unlock celebrations (queued, rarity-coded) */}
        <UnlockCelebrationModal />

        {/* Cosmetic Locker - inventory & equip flow */}
        {lockerOpen && (
          <CosmeticsLocker open={lockerOpen} onClose={() => setLockerOpen(false)} />
        )}
      </Suspense>
    </div>
  );
}

export default App;
