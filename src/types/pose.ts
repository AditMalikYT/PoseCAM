// MediaPipe Pose Landmark Indices (33 keypoints)
export const POSE_LANDMARKS = {
  // Face
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  // Upper body
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  // Lower body
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export type PoseLandmarkIndex = typeof POSE_LANDMARKS[keyof typeof POSE_LANDMARKS];

// 3D landmark with visibility and presence confidence
export interface PoseLandmark {
  x: number;           // Normalized 0-1, relative to image width
  y: number;           // Normalized 0-1, relative to image height
  z: number;           // Depth, relative to hip midpoint
  visibility: number;  // Likelihood (0-1) landmark is visible
  presence: number;    // Likelihood (0-1) landmark is present in image
}

// Complete pose detection result
export interface PoseDetectionResult {
  landmarks: PoseLandmark[];      // 33 landmarks
  worldLandmarks: PoseLandmark[]; // 3D world coordinates
  segmentationMask?: ImageData;   // Person segmentation mask
  poseLandmarksWeight?: Float32Array; // Overall pose confidence
}

// Estimated pose with timestamp and metadata
export interface EstimatedPose {
  landmarks: PoseLandmark[];
  worldLandmarks: PoseLandmark[];
  timestamp: number;
  confidence: number;           // Overall pose confidence
  isPersonPresent: boolean;     // Whether a person was detected
}

// Configuration for pose detection
export interface PoseConfig {
  modelComplexity: 1 | 2 | 3;
  smoothLandmarks: boolean;
  enableSegmentation: boolean;
  smoothSegmentation: boolean;
  refinementMask: boolean;
  minDetectionConfidence: number;
  minPosePresenceConfidence: number;
  minTrackPeriod: number;
}

// Camera/view configuration
export interface CameraConfig {
  width: number;
  height: number;
  facingMode: 'user' | 'environment';
  frameRate: number;
}

// Landmark pair for angle calculation
export interface LandmarkPair {
  start: PoseLandmarkIndex;
  mid: PoseLandmarkIndex;
  end: PoseLandmarkIndex;
}

// Pre-defined joint angle configurations
export const JOINT_ANGLES = {
  // Elbow angle (for push-up depth)
  RIGHT_ELBOW: {
    start: POSE_LANDMARKS.RIGHT_SHOULDER,
    mid: POSE_LANDMARKS.RIGHT_ELBOW,
    end: POSE_LANDMARKS.RIGHT_WRIST,
  },
  LEFT_ELBOW: {
    start: POSE_LANDMARKS.LEFT_SHOULDER,
    mid: POSE_LANDMARKS.LEFT_ELBOW,
    end: POSE_LANDMARKS.LEFT_WRIST,
  },
  // Hip angle (for form check - plank position)
  RIGHT_HIP: {
    start: POSE_LANDMARKS.RIGHT_SHOULDER,
    mid: POSE_LANDMARKS.RIGHT_HIP,
    end: POSE_LANDMARKS.RIGHT_KNEE,
  },
  LEFT_HIP: {
    start: POSE_LANDMARKS.LEFT_SHOULDER,
    mid: POSE_LANDMARKS.LEFT_HIP,
    end: POSE_LANDMARKS.LEFT_KNEE,
  },
  // Knee angle (for squat detection)
  RIGHT_KNEE: {
    start: POSE_LANDMARKS.RIGHT_HIP,
    mid: POSE_LANDMARKS.RIGHT_KNEE,
    end: POSE_LANDMARKS.RIGHT_ANKLE,
  },
  LEFT_KNEE: {
    start: POSE_LANDMARKS.LEFT_HIP,
    mid: POSE_LANDMARKS.LEFT_KNEE,
    end: POSE_LANDMARKS.LEFT_ANKLE,
  },
} as const;

export type JointAngleConfig = LandmarkPair;

// Visibility threshold for considering a landmark "detected"
export const MIN_LANDMARK_CONFIDENCE = 0.5;

// Check if a landmark has sufficient confidence
export function isLandmarkValid(landmark: PoseLandmark): boolean {
  return landmark.visibility >= MIN_LANDMARK_CONFIDENCE && 
         landmark.presence >= MIN_LANDMARK_CONFIDENCE;
}

// Check if all landmarks in a configuration are valid
export function areLandmarksValid(
  landmarks: PoseLandmark[],
  config: JointAngleConfig
): boolean {
  return isLandmarkValid(landmarks[config.start]) &&
         isLandmarkValid(landmarks[config.mid]) &&
         isLandmarkValid(landmarks[config.end]);
}
